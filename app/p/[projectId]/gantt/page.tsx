import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createCpmPlan } from "@/app/actions2";
import JsonRowsInput from "@/components/JsonRowsInput";
import { getProject } from "@/lib/data";
import { cpm, CpmTask } from "@/lib/cpm";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GanttList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const plans = await db.select().from(t.cpmPlans)
    .where(eq(t.cpmPlans.projectId, project.id)).orderBy(desc(t.cpmPlans.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule" title="Gantt / critical path" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {plans.length === 0 ? (
            <EmptyState title="No project plans yet"
              body="List tasks with durations and predecessors; the critical path method computes earliest/latest start and finish, slack per task, the project duration, and which chain of tasks (zero slack) directly sets the finish date — shown on a Gantt chart."
              cta={<Link className="btn" href="#new-plan">Create plan</Link>} />
          ) : plans.map(p => {
            const solved = cpm(p.tasks as CpmTask[]);
            return (
              <Link key={p.id} href={`/p/${project.id}/gantt/${p.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                <span className="font-semibold text-sm">{p.name}</span>
                <span className="text-xs text-steel mono">
                  {(p.tasks as any[]).length} tasks{solved.ok ? ` · duration ${solved.projectDuration} · critical: ${solved.criticalPath.join(" → ")}` : ""}
                </span>
              </Link>
            );
          })}
        </div>
        <Card title="New project plan" id="new-plan">
          <ActionForm action={createCpmPlan} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Name</label><input className="input" name="name" required placeholder="e.g. Line 3 relocation" data-kbd="new" /></div>
            <div>
              <label className="label">Tasks</label>
              <JsonRowsInput name="rows" addLabel="+ Add task" min={2}
                columns={[
                  { key: "key", label: "ID", width: "52px", placeholder: "A" },
                  { key: "name", label: "Task", placeholder: "e.g. Order rigging" },
                  { key: "duration", label: "Dur", type: "number", width: "56px", placeholder: "3" },
                  { key: "preds", label: "After", width: "76px", placeholder: "A,B" },
                ]} />
            </div>
            <p className="text-xs text-steel">Duration in any consistent unit (days). &quot;After&quot; lists the predecessor IDs this task must wait for, comma-separated; leave blank for start tasks. Cycles are rejected.</p>
            <Submit>Compute critical path</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
