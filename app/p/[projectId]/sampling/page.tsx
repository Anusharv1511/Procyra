import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createSamplingPlan, recordSamplingResult } from "@/app/actions2";
import { getProject } from "@/lib/data";
import { SUPPORTED_AQLS, samplingDecision } from "@/lib/sampling";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SamplingPage({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const plans = await db.select().from(t.samplingPlans)
    .where(eq(t.samplingPlans.projectId, project.id)).orderBy(desc(t.samplingPlans.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Risk & compliance" title="Acceptance sampling" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {plans.length === 0 ? (
            <EmptyState title="No sampling plans yet"
              body="Enter a lot size and AQL to get a Z1.4-style single sampling plan (general level II, normal inspection): how many units to inspect and the accept/reject numbers. Then record the defects found and the lot decision is made for you, with the reasoning shown."
              cta={<Link className="btn" href="#new-plan">Create plan</Link>} />
          ) : plans.map(p => {
            const decided = p.defectsFound != null;
            const dec = decided ? samplingDecision({ acceptNum: p.acceptNum }, p.defectsFound!) : null;
            return (
              <div key={p.id} className="card px-4 py-3">
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  <div>
                    <span className="font-semibold text-sm">{p.name}</span>
                    <span className="text-xs text-steel ml-2 mono">lot {p.lotSize} · AQL {p.aql} → n = {p.sampleSize}, Ac {p.acceptNum} / Re {p.acceptNum + 1}</span>
                  </div>
                  {decided
                    ? <Badge tone={dec!.accept ? "ok" : "alarm"}>{dec!.accept ? "ACCEPTED" : "REJECTED"} — {p.defectsFound} defect{p.defectsFound === 1 ? "" : "s"}</Badge>
                    : <Badge tone="quiet">awaiting inspection</Badge>}
                </div>
                {decided && <p className="text-xs text-steel mt-1.5">{dec!.reasoning}</p>}
                {!decided && (
                  <ActionForm action={recordSamplingResult} className="flex items-end gap-2 mt-2">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="id" value={p.id} />
                    <div>
                      <label className="label">Defects found in the {p.sampleSize}-unit sample</label>
                      <input className="input mono !py-1.5 w-32" name="defectsFound" type="number" min={0} required />
                    </div>
                    <Submit quiet>Decide lot</Submit>
                  </ActionForm>
                )}
              </div>
            );
          })}
        </div>
        <Card title="New sampling plan" id="new-plan">
          <ActionForm action={createSamplingPlan} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Name / lot reference</label><input className="input" name="name" required placeholder="e.g. Supplier lot 2231 — castings" data-kbd="new" /></div>
            <div><label className="label">Lot size</label><input className="input mono" name="lotSize" type="number" min={2} required placeholder="e.g. 1000" /></div>
            <div><label className="label">AQL (%)</label>
              <select className="input mono" name="aql">
                {SUPPORTED_AQLS.map(a => <option key={a} value={a}>{a}</option>)}
              </select></div>
            <Submit>Determine plan</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">Z1.4-style single sampling, general inspection level II, normal inspection. The built-in table reproduces the standard&apos;s structure for these common AQLs (validated against known plans, e.g. lot 1 000 at AQL 2.5 → n = 80, Ac = 5) — it is not a certified replacement for the standard document.</p>
        </Card>
      </div>
    </div>
  );
}
