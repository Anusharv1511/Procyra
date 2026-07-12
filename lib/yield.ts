// Part D — Yield / scrap. FPY, rolled throughput yield across stages, scrap
// Pareto, and the entry-time rule runner. A yield stage is a Stream of type
// "YIELD" (reusing the existing streams/data_points/alerts platform — no
// schema change); payload = { started, passed, scrap: [{ reason, qty }] };
// stream.target holds the configurable FPY alert threshold as a fraction.
// The alert fires after 3 consecutive entries below threshold, mirroring the
// OEE_BELOW_TARGET pattern in lib/rules.ts exactly (same open-alert dedupe).

import { db, t } from "@/db";
import { and, asc, eq } from "drizzle-orm";

export type YieldEntry = { started: number; passed: number; scrap: { reason: string; qty: number }[] };

export const fpy = (e: { started: number; passed: number }) =>
  e.started > 0 ? e.passed / e.started : 0;

/** Rolled throughput yield = Π stage FPY (each stage = one YIELD stream). */
export const rty = (stageFpys: number[]) => stageFpys.reduce((a, b) => a * b, 1);

/** Aggregate scrap quantities by reason, sorted descending, with cumulative %. */
export function scrapPareto(entries: YieldEntry[]) {
  const byReason: Record<string, number> = {};
  for (const e of entries) for (const s of e.scrap ?? [])
    byReason[s.reason] = (byReason[s.reason] ?? 0) + s.qty;
  const rows = Object.entries(byReason).map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((a, r) => a + r.count, 0);
  let cum = 0;
  return rows.map(r => { cum += r.count; return { ...r, cumPct: total ? (100 * cum) / total : 0 }; });
}

const YIELD_RUN = 3; // consecutive entries below threshold — mirrors OEE's RUN = 3

/** Called after inserting a YIELD data point. Computes FPY, flags a run below threshold. */
export async function runYieldRules(streamId: string, pointId: string) {
  const [stream] = await db.select().from(t.streams).where(eq(t.streams.id, streamId));
  if (!stream) return null;
  const pts = await db.select().from(t.dataPoints)
    .where(eq(t.dataPoints.streamId, streamId)).orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt));
  const threshold = stream.target ?? 0.95;

  const computedAll = pts.map(p => {
    const pl = p.payload as YieldEntry;
    const scrapQty = (pl.scrap ?? []).reduce((a, s) => a + s.qty, 0);
    return { fpy: fpy(pl), scrapQty };
  });
  const idx = pts.findIndex(p => p.id === pointId);
  const c = computedAll[idx];
  await db.update(t.dataPoints).set({ computed: c }).where(eq(t.dataPoints.id, pointId));

  if (pts.length >= YIELD_RUN) {
    const lastRun = computedAll.slice(-YIELD_RUN);
    if (lastRun.every(x => x.fpy < threshold) && idx === pts.length - 1) {
      const open = await db.select().from(t.alerts).where(and(
        eq(t.alerts.streamId, streamId), eq(t.alerts.ruleCode, "YIELD_BELOW_THRESHOLD"), eq(t.alerts.status, "open"),
      ));
      if (open.length === 0) {
        await db.insert(t.alerts).values({
          projectId: stream.projectId, streamId, sourceType: "YIELD",
          ruleCode: "YIELD_BELOW_THRESHOLD", severity: "warning",
          message: `${stream.name}: first-pass yield below threshold (${(threshold * 100).toFixed(0)}%) for ${YIELD_RUN} consecutive entries`,
        });
      }
    }
  }
  return c;
}
