import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createDoe } from "@/app/actions2";
import JsonRowsInput from "@/components/JsonRowsInput";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DoeList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const studies = await db.select().from(t.doeStudies)
    .where(eq(t.doeStudies.projectId, project.id)).orderBy(desc(t.doeStudies.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze" title="Design of Experiments (DOE)" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {studies.length === 0 ? (
            <EmptyState title="No experiments yet"
              body="A 2-level factorial experiment varies all your candidate settings together in a planned pattern, so a handful of runs tells you which factor actually moves the response — and whether factors interact. Define 2–4 factors; the run plan is generated for you."
              cta={<Link className="btn" href="#new-doe">Design experiment</Link>} />
          ) : studies.map(st => {
            const runs = st.runs as any[];
            const doneRuns = runs.filter(r => r.response != null).length;
            return (
              <Link key={st.id} href={`/p/${project.id}/doe/${st.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                <div>
                  <span className="font-semibold text-sm">{st.name}</span>
                  <span className="text-xs text-steel ml-2">{(st.factors as any[]).length} factors · 2^{(st.factors as any[]).length}{st.designType === "half" ? "⁻¹" : ""} = {runs.length} runs</span>
                </div>
                <Badge tone={doneRuns === runs.length ? "ok" : "quiet"}>{doneRuns}/{runs.length} runs entered</Badge>
              </Link>
            );
          })}
        </div>
        <Card title="Design a new experiment" id="new-doe">
          <ActionForm action={createDoe} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Name</label><input className="input" name="name" required placeholder="e.g. OD variation — turning parameters" data-kbd="new" /></div>
            <div><label className="label">Response being measured</label><input className="input" name="responseName" placeholder="e.g. OD deviation (µm)" /></div>
            <div>
              <label className="label">Factors (2–4), each at two levels</label>
              <JsonRowsInput name="rows" addLabel="+ Add factor" min={2}
                columns={[
                  { key: "name", label: "Factor", placeholder: "e.g. Feed rate" },
                  { key: "low", label: "Low (−)", width: "80px", placeholder: "0.1" },
                  { key: "high", label: "High (+)", width: "80px", placeholder: "0.2" },
                ]} />
            </div>
            <div><label className="label">Design (4 factors only)</label>
              <select className="input" name="designType">
                <option value="full">Full factorial (all combinations)</option>
                <option value="half">Half fraction 2⁴⁻¹ (8 runs, D = ABC)</option>
              </select>
              <p className="text-xs text-steel mt-1">With 2–3 factors the full factorial is always used (4 or 8 runs).</p></div>
            <Submit>Generate run plan</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
