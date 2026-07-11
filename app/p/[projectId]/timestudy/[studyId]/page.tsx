import { Card, PageHeader, Stat } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addTimeStudyElement } from "@/app/actions";
import LearningCurve from "@/components/charts/LearningCurve";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { elementTimes, standardTime, learningCurve } from "@/lib/timestudy";

export const dynamic = "force-dynamic";

export default async function StudyDetail({ params }: { params: { projectId: string; studyId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [study] = await db.select().from(t.timeStudies).where(eq(t.timeStudies.id, params.studyId));
  if (!study || study.projectId !== project.id) notFound();
  const elements = await db.select().from(t.timeStudyElements)
    .where(eq(t.timeStudyElements.studyId, study.id)).orderBy(asc(t.timeStudyElements.seq));

  const rows = elements.map(el => {
    const obs = (el.observations as number[]) ?? [];
    const { observed, normal } = elementTimes({ observations: obs, rating: el.rating });
    return { ...el, obs, observed, normal };
  });
  const normalTotal = rows.reduce((a, r) => a + r.normal, 0);
  const std = standardTime(normalTotal, study.personalPct, study.fatiguePct, study.delayPct);
  const curve = std > 0 ? learningCurve(std, study.learningCurvePct) : [];
  const allowancePct = study.personalPct + study.fatiguePct + study.delayPct;

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze · time study" title={study.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Elements" value={String(rows.length)} />
        <Stat label="Normal time" value={normalTotal ? `${normalTotal.toFixed(3)} min` : "—"} />
        <Stat label={`PFD allowance`} value={`${allowancePct}%`} />
        <Stat label="Standard time" value={std ? `${std.toFixed(3)} min` : "—"} tone="ok" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Elements">
            <div className="overflow-x-auto">
              <table className="data">
                <thead><tr><th>#</th><th>Element</th><th>Observations (min)</th><th>Avg observed</th><th>Rating</th><th>Normal time</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className="mono">{r.seq}</td>
                      <td>{r.description}</td>
                      <td className="mono text-xs">{r.obs.join(", ")}</td>
                      <td className="mono">{r.observed.toFixed(3)}</td>
                      <td className="mono">{r.rating}%</td>
                      <td className="mono font-semibold">{r.normal.toFixed(3)}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={6} className="text-steel">Add the first element.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-steel mt-2">
              Normal = avg observed × rating. Standard = Σ normal × (1 + PFD). Standard time here: <span className="mono font-semibold">{std ? std.toFixed(3) : "—"} min/unit</span>.
            </p>
          </Card>
          {curve.length > 0 && (
            <Card title={`Learning curve projection (${study.learningCurvePct}% rate, first 32 units)`}>
              <LearningCurve data={curve} unit="min" />
              <p className="text-xs text-steel mt-2">Wright model: unit 1 starts at the standard time; each doubling of cumulative output takes {study.learningCurvePct}% of the prior per-unit time. Use for new operators / new products, not steady state.</p>
            </Card>
          )}
        </div>
        <Card title="Add element">
          <ActionForm action={addTimeStudyElement} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="studyId" value={study.id} />
            <div><label className="label">Description</label><input className="input" name="description" required placeholder="e.g. Pick and place housing" /></div>
            <div><label className="label">Observed times, min (comma separated)</label>
              <input className="input mono" name="observations" required placeholder="0.42, 0.45, 0.40, 0.44" /></div>
            <div><label className="label">Performance rating %</label>
              <input className="input mono" name="rating" type="number" min={50} max={150} defaultValue={100} />
              <p className="text-xs text-steel mt-1">100 = normal pace; 110 = observed operator was 10% faster than normal.</p></div>
            <Submit>Add element</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
