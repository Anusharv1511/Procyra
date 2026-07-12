import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createCapacityStudy } from "@/app/actions2";
import JsonRowsInput from "@/components/JsonRowsInput";
import { getProject } from "@/lib/data";
import { capacityAnalysis, CapacityStep } from "@/lib/capacity";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CapacityList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [studies, lineBalances] = await Promise.all([
    db.select().from(t.capacityStudies).where(eq(t.capacityStudies.projectId, project.id)).orderBy(desc(t.capacityStudies.createdAt)),
    db.select().from(t.lineBalances).where(eq(t.lineBalances.projectId, project.id)).orderBy(desc(t.lineBalances.createdAt)),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule" title="Capacity & bottlenecks" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {studies.length === 0 ? (
            <EmptyState title="No capacity studies yet"
              body="Enter each process step's cycle time and available time (or reuse a line-balance study's stations) to see per-step capacity, where the bottleneck sits, and the whole line's sustainable output — the number the bottleneck sets for everyone else."
              cta={<Link className="btn" href="#new-cap">Create study</Link>} />
          ) : studies.map(cs => {
            const r = capacityAnalysis(cs.steps as CapacityStep[]);
            return (
              <Link key={cs.id} href={`/p/${project.id}/capacity/${cs.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                <div>
                  <span className="font-semibold text-sm">{cs.name}</span>
                  <span className="text-xs text-steel ml-2">{(cs.steps as any[]).length} steps{cs.sourceLineBalanceId ? " · from line balance" : ""}</span>
                </div>
                <span className="mono text-sm">
                  line capacity <span className="font-bold">{r.lineCapacity.toFixed(0)}</span> u/period
                  {r.bottleneck && <span className="text-alarm font-semibold ml-2">⌁ {r.bottleneck.name}</span>}
                </span>
              </Link>
            );
          })}
        </div>
        <Card title="New capacity study" id="new-cap">
          <ActionForm action={createCapacityStudy} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Name</label><input className="input" name="name" required placeholder="e.g. Machining cell — current state" data-kbd="new" /></div>
            {lineBalances.length > 0 && (
              <div><label className="label">Reuse a line-balance study (optional)</label>
                <select className="input" name="fromLineBalance">
                  <option value="">— enter steps manually below —</option>
                  {lineBalances.map(lb => <option key={lb.id} value={lb.id}>{lb.name} ({(lb.stations as any[]).length} stations)</option>)}
                </select>
                <p className="text-xs text-steel mt-1">Stations and the study&apos;s available time are copied in as steps; manual rows below are then ignored.</p></div>
            )}
            <div>
              <label className="label">Steps (manual entry)</label>
              <JsonRowsInput name="rows" addLabel="+ Add step" min={1}
                columns={[
                  { key: "name", label: "Step", placeholder: "e.g. Milling" },
                  { key: "cycleTime", label: "Cycle (min/u)", type: "number", width: "92px", placeholder: "1.5" },
                  { key: "availableTime", label: "Avail (min)", type: "number", width: "88px", placeholder: "450" },
                ]} />
            </div>
            <Submit>Analyze capacity</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">Capacity per step = available time ÷ cycle time. Steps may have different available times (e.g. a shared machine only free half a shift).</p>
        </Card>
      </div>
    </div>
  );
}
