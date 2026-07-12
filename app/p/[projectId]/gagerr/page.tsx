import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createGageStudy } from "@/app/actions2";
import AlertsBanner from "@/components/AlertsBanner";
import { getProject } from "@/lib/data";
import { gageRnR } from "@/lib/gagerr";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GageList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const studies = await db.select().from(t.gageStudies)
    .where(eq(t.gageStudies.projectId, project.id)).orderBy(desc(t.gageStudies.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze" title="Gage R&R / MSA" />
      <AlertsBanner projectId={project.id} sourceTypes={["MSA"]} scopeLabel="this project's measurement systems" inboxCategory="MSA" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {studies.length === 0 ? (
            <EmptyState title="No Gage R&R studies yet"
              body="A Gage R&R study answers one question before any other analysis: can this measurement system tell parts apart, or is it mostly measuring itself? Set up parts × operators × trials, enter the measurements, and the AIAG average-and-range verdict is computed automatically."
              cta={<Link className="btn" href="#new-study">Create study</Link>} />
          ) : studies.map(st => {
            const r = gageRnR(st.data as any, st.tolerance);
            const done = "pctGrr" in r;
            return (
              <Link key={st.id} href={`/p/${project.id}/gagerr/${st.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                <div>
                  <span className="font-semibold text-sm">{st.name}</span>
                  <span className="text-xs text-steel ml-2">{st.parts} parts · {st.operators} operators · {st.trials} trials</span>
                </div>
                {done
                  ? <Badge tone={r.verdict === "acceptable" ? "ok" : r.verdict === "marginal" ? "warn" : "alarm"}>%GRR {r.pctGrr.toFixed(1)}% — {r.verdict}</Badge>
                  : <Badge tone="quiet">data incomplete</Badge>}
              </Link>
            );
          })}
        </div>
        <Card title="New Gage R&R study" id="new-study">
          <ActionForm action={createGageStudy} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Name</label>
              <input className="input" name="name" required placeholder="e.g. OD micrometer — lathe cell" data-kbd="new" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label">Parts</label><input className="input mono" name="parts" type="number" min={2} max={15} defaultValue={10} /></div>
              <div><label className="label">Operators</label><input className="input mono" name="operators" type="number" min={2} max={5} defaultValue={3} /></div>
              <div><label className="label">Trials</label><input className="input mono" name="trials" type="number" min={2} max={3} defaultValue={3} /></div>
            </div>
            <div><label className="label">Tolerance (USL − LSL, optional)</label>
              <input className="input mono" name="tolerance" type="number" step="any" placeholder="e.g. 0.042" />
              <p className="text-xs text-steel mt-1">When given, %Tolerance (6·GRR ÷ tolerance) is reported alongside %GRR.</p></div>
            <Submit>Create study</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">AIAG guidance: pick parts that span the real process spread; 10 parts × 3 operators × 3 trials is the standard layout. Trials of 2 or 3 use the matching d2 constant (1.128 / 1.693).</p>
        </Card>
      </div>
    </div>
  );
}
