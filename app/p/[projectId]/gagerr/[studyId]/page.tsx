import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveGageData } from "@/app/actions2";
import GageGrid from "@/components/GageGrid";
import { getProject } from "@/lib/data";
import { gageRnR } from "@/lib/gagerr";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GageStudy({ params }: { params: { projectId: string; studyId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [study] = await db.select().from(t.gageStudies).where(eq(t.gageStudies.id, params.studyId));
  if (!study || study.projectId !== project.id) notFound();
  const r = gageRnR(study.data as any, study.tolerance);
  const done = "pctGrr" in r;
  const tone = done ? (r.verdict === "acceptable" ? "ok" : r.verdict === "marginal" ? "warn" : "alarm") : undefined;

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze · Gage R&R" title={study.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="%GRR" value={done ? `${r.pctGrr.toFixed(1)}%` : "—"} tone={tone}
          help="Gage variation as a share of total variation. AIAG: <10% acceptable, 10–30% marginal, >30% unacceptable." />
        <Stat label="%Tolerance" value={done && r.pctTolerance != null ? `${r.pctTolerance.toFixed(1)}%` : "—"}
          help="6·GRR compared to the spec width — how much of the tolerance the gage itself consumes." />
        <Stat label="ndc" value={done ? String(r.ndc) : "—"} tone={done ? (r.ndc >= 5 ? "ok" : "warn") : undefined}
          help="Number of distinct categories = ⌊1.41·PV/GRR⌋. AIAG wants ≥ 5 — below that the gage can barely group parts." />
        <Stat label="Verdict" value={done ? r.verdict : "incomplete"} tone={tone} />
      </div>

      <Card title={`Measurements — ${study.operators} operators × ${study.parts} parts × ${study.trials} trials`}>
        <ActionForm action={saveGageData} className="space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="studyId" value={study.id} />
          <GageGrid operators={study.operators} parts={study.parts} trials={study.trials} initial={study.data as any} />
          <Submit>Save measurements</Submit>
        </ActionForm>
        <p className="text-xs text-steel mt-2">Every operator measures every part {study.trials} times, in random order, without seeing others&apos; results. Results recompute on save; a %GRR above 30% raises an alert.</p>
      </Card>

      {done && (
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <Card title="Variance components (average & range method)">
            <table className="data">
              <thead><tr><th>Component</th><th>σ</th><th>% of total variation</th></tr></thead>
              <tbody>
                <tr><td>EV — repeatability (equipment)</td><td className="mono">{r.ev.toFixed(5)}</td><td className="mono">{r.pctEv.toFixed(1)}%</td></tr>
                <tr><td>AV — reproducibility (appraisers)</td><td className="mono">{r.av.toFixed(5)}</td><td className="mono">{r.pctAv.toFixed(1)}%</td></tr>
                <tr><td className="font-semibold">GRR = √(EV² + AV²)</td><td className="mono font-semibold">{r.grr.toFixed(5)}</td><td className="mono font-semibold">{r.pctGrr.toFixed(1)}%</td></tr>
                <tr><td>PV — part-to-part</td><td className="mono">{r.pv.toFixed(5)}</td><td className="mono">{r.pctPv.toFixed(1)}%</td></tr>
                <tr><td>TV = √(GRR² + PV²)</td><td className="mono">{r.tv.toFixed(5)}</td><td className="mono">100%</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-steel mt-2">EV = R̄̄/d₂ (d₂ = {study.trials === 2 ? "1.128" : "1.693"} for {study.trials} trials); AV from the operator-average spread with the EV contribution removed; PV from the part-average range.</p>
          </Card>
          <Card title="Reading the result">
            <div className="space-y-2 text-sm">
              <p><Badge tone={tone as any}>{r.verdict.toUpperCase()}</Badge></p>
              {r.verdict === "acceptable" && <p>The measurement system contributes little to observed variation — chart signals and capability numbers from this gage can be trusted.</p>}
              {r.verdict === "marginal" && <p>Usable with caution (AIAG: may be acceptable based on the application&apos;s importance and cost of improvement). Consider operator training if AV dominates, or gage maintenance/replacement if EV dominates.</p>}
              {r.verdict === "unacceptable" && <p className="text-alarm font-medium">More than 30% of what this gage reports is measurement error. Fix the measurement system before drawing conclusions from its data — an alert has been raised on this project.</p>}
              <p className="text-xs text-steel">{r.pctAv > r.pctEv ? "Reproducibility (operator differences) is the larger contributor — look at method consistency, fixturing, and training." : "Repeatability (the equipment itself) is the larger contributor — look at gage condition, resolution, and fixturing."}</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
