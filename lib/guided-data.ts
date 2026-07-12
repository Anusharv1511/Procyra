// Part P — pulls the chosen tool's REAL current output from live project data
// so it flows back into the playbook step automatically (no re-entry).
// Read-only: uses the existing pure math in lib/spc, lib/gagerr, lib/doe,
// lib/timestudy without modifying any of it.

import { db, t } from "@/db";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { xbarRLimits, imrLimits, westernElectric, capability, mean, range } from "./spc";
import { gageRnR } from "./gagerr";
import { doeEffects, doeSummary } from "./doe";
import { elementTimes, standardTime } from "./timestudy";
import type { ToolKey } from "./guided";

export type ToolResult = { tool: ToolKey; summary: string; detail?: string; href: string | null } | null;

async function spcSnapshot(projectId: string) {
  const streams = await db.select().from(t.streams).where(eq(t.streams.projectId, projectId));
  const spcStreams = streams.filter(s => s.type.startsWith("SPC"));
  if (!spcStreams.length) return null;
  // Most recently updated SPC stream with data.
  const pts = await db.select().from(t.dataPoints)
    .where(inArray(t.dataPoints.streamId, spcStreams.map(s => s.id)))
    .orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt));
  const byStream = new Map<string, typeof pts>();
  for (const p of pts) {
    if (!byStream.has(p.streamId)) byStream.set(p.streamId, []);
    byStream.get(p.streamId)!.push(p);
  }
  let best: { stream: (typeof spcStreams)[number]; pts: typeof pts } | null = null;
  for (const st of spcStreams) {
    const sp = byStream.get(st.id) ?? [];
    if (!sp.length) continue;
    if (!best || +new Date(sp[sp.length - 1].ts) > +new Date(best.pts[best.pts.length - 1].ts))
      best = { stream: st, pts: sp };
  }
  if (!best || best.pts.length < 2) return null;
  const isXbar = best.stream.type === "SPC_XBAR_R";
  const valuesPerPoint = best.pts.map(p => ((p.payload as any).values as number[]) ?? []);
  const means = valuesPerPoint.map(v => (isXbar ? mean(v) : v[0]));
  const ranges = isXbar ? valuesPerPoint.map(v => range(v)) : [];
  const lim = isXbar ? xbarRLimits(means, ranges, best.stream.subgroupSize) : imrLimits(means);
  const sigmaPlot = isXbar ? lim.sigmaWithin / Math.sqrt(best.stream.subgroupSize) : lim.sigmaWithin;
  const flags = westernElectric(means, lim.center, sigmaPlot);
  const cap = (best.stream.specLow != null || best.stream.specHigh != null) && best.pts.length >= 10
    ? capability(valuesPerPoint.flat(), lim.sigmaWithin, best.stream.specLow, best.stream.specHigh)
    : null;
  return { stream: best.stream, n: best.pts.length, lim, flags, cap };
}

export async function latestToolResult(projectId: string, tool: ToolKey): Promise<ToolResult> {
  if (tool === "spc" || tool === "capability") {
    const snap = await spcSnapshot(projectId);
    if (!snap) return { tool, summary: "No SPC data yet — create a stream and log at least a few points, then this step will pull the live result.", href: `/p/${projectId}/spc` };
    if (tool === "spc") {
      return {
        tool,
        summary: `${snap.stream.name}: ${snap.n} entries — latest point ${snap.flags.length ? `OUT OF CONTROL (${snap.flags.map(f => f.rule).join(", ")})` : "in control"}.`,
        detail: `CL ${snap.lim.center.toFixed(3)}, UCL ${snap.lim.ucl.toFixed(3)}, LCL ${snap.lim.lcl.toFixed(3)}${snap.stream.unit ? " " + snap.stream.unit : ""}.`,
        href: `/p/${projectId}/spc/${snap.stream.id}`,
      };
    }
    if (!snap.cap?.cpk && snap.cap?.cpk !== 0)
      return { tool, summary: `${snap.stream.name}: capability needs spec limits and ≥10 points (currently ${snap.n}).`, href: `/p/${projectId}/capability` };
    const below = snap.cap.cpk! < snap.stream.cpkThreshold;
    return {
      tool,
      summary: `${snap.stream.name}: Cpk ${snap.cap.cpk!.toFixed(2)} vs threshold ${snap.stream.cpkThreshold} — ${below ? "NOT capable; the process cannot reliably hold the spec" : "capable"}.`,
      detail: `Ppk ${snap.cap.ppk?.toFixed(2) ?? "—"}, mean ${snap.cap.mean.toFixed(3)}, n = ${snap.cap.n}.`,
      href: `/p/${projectId}/capability`,
    };
  }
  if (tool === "gagerr") {
    const [study] = await db.select().from(t.gageStudies)
      .where(eq(t.gageStudies.projectId, projectId)).orderBy(desc(t.gageStudies.createdAt)).limit(1);
    if (!study) return { tool, summary: "No Gage R&R study yet — create one, enter the measurements, and this step will pull the live %GRR.", href: `/p/${projectId}/gagerr` };
    const r = gageRnR(study.data as any, study.tolerance);
    if (!("pctGrr" in r)) return { tool, summary: `${study.name}: measurement grid incomplete — finish entering trials to get %GRR.`, href: `/p/${projectId}/gagerr/${study.id}` };
    return {
      tool,
      summary: `${study.name}: %GRR ${r.pctGrr.toFixed(1)}% (${r.verdict}), ndc ${r.ndc}${r.pctTolerance != null ? `, %Tolerance ${r.pctTolerance.toFixed(1)}%` : ""}.`,
      detail: r.verdict === "unacceptable" ? "Fix the measurement system before trusting data collected with it." : undefined,
      href: `/p/${projectId}/gagerr/${study.id}`,
    };
  }
  if (tool === "timestudy") {
    const [study] = await db.select().from(t.timeStudies)
      .where(eq(t.timeStudies.projectId, projectId)).orderBy(desc(t.timeStudies.createdAt)).limit(1);
    if (!study) return { tool, summary: "No time study yet — create one and log elements; this step will pull the live standard time.", href: `/p/${projectId}/timestudy` };
    const els = await db.select().from(t.timeStudyElements).where(eq(t.timeStudyElements.studyId, study.id));
    if (!els.length) return { tool, summary: `${study.name}: no elements logged yet.`, href: `/p/${projectId}/timestudy/${study.id}` };
    const normalTotal = els.reduce((a, el) => a + elementTimes({ observations: el.observations as number[], rating: el.rating }).normal, 0);
    const std = standardTime(normalTotal, study.personalPct, study.fatiguePct, study.delayPct);
    return {
      tool,
      summary: `${study.name}: standard time ${std.toFixed(3)} min/unit over ${els.length} element${els.length === 1 ? "" : "s"} (PFD ${study.personalPct + study.fatiguePct + study.delayPct}%).`,
      href: `/p/${projectId}/timestudy/${study.id}`,
    };
  }
  if (tool === "doe") {
    const [study] = await db.select().from(t.doeStudies)
      .where(eq(t.doeStudies.projectId, projectId)).orderBy(desc(t.doeStudies.createdAt)).limit(1);
    if (!study) return { tool, summary: "No DOE yet — design one, run it, enter responses; this step will pull the live effects.", href: `/p/${projectId}/doe` };
    const res = doeEffects(study.factors as any, study.runs as any, study.designType as any);
    if (!res.complete) return { tool, summary: `${study.name}: runs not complete yet — enter the remaining responses.`, href: `/p/${projectId}/doe/${study.id}` };
    return {
      tool,
      summary: `${study.name}: ${doeSummary(study.factors as any, res.effects)}`,
      href: `/p/${projectId}/doe/${study.id}`,
    };
  }
  return null;
}
