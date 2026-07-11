// Rules & Alerts engine — every rule here runs automatically server-side on
// data entry. No manual re-trigger, per product requirement "Automate".

import { db, t } from "@/db";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { xbarRLimits, imrLimits, westernElectric, capability, oee, mean, range, WEFlag } from "./spc";
import { defaults } from "./terminology";

async function raise(a: {
  projectId: string; streamId?: string | null; sourceType: string; sourceId?: string;
  ruleCode: string; severity?: string; message: string;
}) {
  await db.insert(t.alerts).values({
    projectId: a.projectId, streamId: a.streamId ?? null, sourceType: a.sourceType,
    sourceId: a.sourceId ?? null, ruleCode: a.ruleCode,
    severity: a.severity ?? "warning", message: a.message,
  });
}

/**
 * Called after inserting an SPC data point. Recomputes limits over the stream,
 * evaluates Western Electric rules for the new point, stores flags on the
 * point, raises alerts, and re-checks capability against the stream threshold.
 * Returns the flags so the UI can show them immediately.
 */
export async function runSpcRules(streamId: string, pointId: string): Promise<WEFlag[]> {
  const [stream] = await db.select().from(t.streams).where(eq(t.streams.id, streamId));
  if (!stream) return [];
  const pts = await db.select().from(t.dataPoints)
    .where(eq(t.dataPoints.streamId, streamId)).orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt));
  if (pts.length === 0) return [];

  const isXbar = stream.type === "SPC_XBAR_R";
  const valuesPerPoint = pts.map(p => ((p.payload as any).values as number[]) ?? []);
  const means = valuesPerPoint.map(v => (isXbar ? mean(v) : v[0]));
  const ranges = isXbar ? valuesPerPoint.map(v => range(v)) : [];

  const lim = isXbar
    ? xbarRLimits(means, ranges, stream.subgroupSize)
    : imrLimits(means);
  const sigmaPlot = isXbar ? lim.sigmaWithin / Math.sqrt(stream.subgroupSize) : lim.sigmaWithin;

  // Rules need >= 2 points to have meaningful limits.
  let flags: WEFlag[] = [];
  if (pts.length >= 2) {
    flags = westernElectric(means, lim.center, sigmaPlot);
  }

  const idx = pts.findIndex(p => p.id === pointId);
  const computed = {
    mean: means[idx], range: isXbar ? ranges[idx] : null, flags,
  };
  await db.update(t.dataPoints).set({ computed }).where(eq(t.dataPoints.id, pointId));

  for (const f of flags) {
    await raise({
      projectId: stream.projectId, streamId, sourceType: "SPC", sourceId: pointId,
      ruleCode: f.rule, severity: f.rule === "WE1" ? "critical" : "warning",
      message: `${stream.name}: ${f.message}`,
    });
  }

  // Capability re-check (rolling, all points; needs specs + enough data).
  if ((stream.specLow != null || stream.specHigh != null) && pts.length >= 10) {
    const all = valuesPerPoint.flat();
    const cap = capability(all, lim.sigmaWithin, stream.specLow, stream.specHigh);
    if (cap.cpk != null && cap.cpk < stream.cpkThreshold) {
      // Avoid alert spam: only raise if no open CPK_LOW alert exists for this stream.
      const open = await db.select().from(t.alerts).where(and(
        eq(t.alerts.streamId, streamId), eq(t.alerts.ruleCode, "CPK_LOW"), eq(t.alerts.status, "open"),
      ));
      if (open.length === 0) {
        await raise({
          projectId: stream.projectId, streamId, sourceType: "CAPABILITY",
          ruleCode: "CPK_LOW", severity: "critical",
          message: `${stream.name}: Cpk ${cap.cpk.toFixed(2)} below threshold ${stream.cpkThreshold}`,
        });
      }
    }
  }
  return flags;
}

/** Called after inserting an OEE data point. Computes OEE, flags run-below-target. */
export async function runOeeRules(streamId: string, pointId: string) {
  const [stream] = await db.select().from(t.streams).where(eq(t.streams.id, streamId));
  if (!stream) return null;
  const pts = await db.select().from(t.dataPoints)
    .where(eq(t.dataPoints.streamId, streamId)).orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt));
  const target = stream.target ?? 0.85;

  const computedAll = pts.map(p => oee(p.payload as any));
  const idx = pts.findIndex(p => p.id === pointId);
  const c = computedAll[idx];
  await db.update(t.dataPoints).set({ computed: c }).where(eq(t.dataPoints.id, pointId));

  const RUN = 3; // consecutive entries below target
  if (pts.length >= RUN) {
    const lastRun = computedAll.slice(-RUN);
    if (lastRun.every(x => x.oee < target) && idx === pts.length - 1) {
      const open = await db.select().from(t.alerts).where(and(
        eq(t.alerts.streamId, streamId), eq(t.alerts.ruleCode, "OEE_BELOW_TARGET"), eq(t.alerts.status, "open"),
      ));
      if (open.length === 0) {
        await raise({
          projectId: stream.projectId, streamId, sourceType: "OEE",
          ruleCode: "OEE_BELOW_TARGET", severity: "warning",
          message: `${stream.name}: OEE below target (${(target * 100).toFixed(0)}%) for ${RUN} consecutive entries`,
        });
      }
    }
  }
  return c;
}

/**
 * Called after logging a non-conformance. If the same defectCode+processArea
 * recurs >= threshold times in the window and no open auto-CAPA exists for it,
 * auto-draft a CAPA (status "draft" — the user confirms; nothing silently final).
 */
export async function runNcRules(projectId: string, ncId: string, industry: string) {
  const [nc] = await db.select().from(t.nonConformances).where(eq(t.nonConformances.id, ncId));
  if (!nc) return { autoCapa: null };
  const d = defaults(industry);
  const windowStart = new Date(Date.now() - d.ncRepeatWindowDays * 24 * 3600 * 1000);
  const repeats = await db.select({ n: sql<number>`count(*)` }).from(t.nonConformances).where(and(
    eq(t.nonConformances.projectId, projectId),
    eq(t.nonConformances.defectCode, nc.defectCode),
    eq(t.nonConformances.processArea, nc.processArea),
    gte(t.nonConformances.date, windowStart),
  ));
  const count = Number(repeats[0]?.n ?? 0);
  if (count < d.ncRepeatThreshold) return { autoCapa: null, count };

  const existing = await db.select().from(t.capas).where(and(
    eq(t.capas.projectId, projectId),
    eq(t.capas.source, "auto"),
    eq(t.capas.linkedDefectCode, nc.defectCode),
  ));
  if (existing.some(c => c.status !== "closed" && c.status !== "verified")) return { autoCapa: null, count };

  const [capa] = await db.insert(t.capas).values({
    projectId,
    title: `Recurring ${nc.defectCode} in ${nc.processArea} (${count}x in ${d.ncRepeatWindowDays}d)`,
    source: "auto",
    linkedDefectCode: nc.defectCode,
    status: "draft",
  }).returning();

  await raise({
    projectId, sourceType: "NC", sourceId: nc.id, ruleCode: "NC_REPEAT", severity: "warning",
    message: `${nc.defectCode} recurred ${count}x in ${nc.processArea} — CAPA drafted for your review`,
  });
  return { autoCapa: capa, count };
}

/** Called on FMEA item create/update: recompute RPN server-side, alert on threshold cross. */
export async function runFmeaRules(fmeaId: string, itemId: string) {
  const [fmea] = await db.select().from(t.fmeas).where(eq(t.fmeas.id, fmeaId));
  const [item] = await db.select().from(t.fmeaItems).where(eq(t.fmeaItems.id, itemId));
  if (!fmea || !item) return null;
  const rpn = item.severity * item.occurrence * item.detection;
  await db.update(t.fmeaItems).set({ rpn }).where(eq(t.fmeaItems.id, itemId));
  if (rpn >= fmea.rpnAction) {
    const open = await db.select().from(t.alerts).where(and(
      eq(t.alerts.sourceId, itemId), eq(t.alerts.ruleCode, "RPN_THRESHOLD"), eq(t.alerts.status, "open"),
    ));
    if (open.length === 0) {
      await raise({
        projectId: fmea.projectId, sourceType: "FMEA", sourceId: itemId,
        ruleCode: "RPN_THRESHOLD", severity: rpn >= fmea.rpnAction * 2 ? "critical" : "warning",
        message: `${fmea.name}: "${item.failureMode}" RPN ${rpn} ≥ action threshold ${fmea.rpnAction}`,
      });
    }
  }
  return rpn;
}
