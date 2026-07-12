import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createTask, completeTask } from "@/app/actions";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Tasks({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const tasks = await db.select().from(t.scheduledTasks)
    .where(eq(t.scheduledTasks.projectId, project.id)).orderBy(asc(t.scheduledTasks.nextDue));

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule" title="Recurring tasks" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {tasks.length === 0 && (
            <EmptyState title="Nothing scheduled yet"
              body="Weekly audits, monthly Gage R&R, control-chart reviews — put them here and they surface on the dashboard when due."
              cta={<Link className="btn" href="#new-task">Schedule a task</Link>} />
          )}
          {tasks.map(x => {
            const overdue = new Date(x.nextDue).getTime() < Date.now();
            const dueSoon = !overdue && new Date(x.nextDue).getTime() < Date.now() + 3 * 86400000;
            return (
              <Card key={x.id}>
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <span className="font-semibold text-sm">{x.title}</span>
                    <div className="flex gap-2 mt-1 items-center flex-wrap">
                      <Badge tone="quiet">{x.recurrence}</Badge>
                      {overdue && <Badge tone="alarm">overdue</Badge>}
                      {dueSoon && <Badge tone="warn">due soon</Badge>}
                      <span className="text-xs text-steel mono">next: {new Date(x.nextDue).toLocaleDateString()}</span>
                      {x.lastCompleted && <span className="text-xs text-steel mono">last done: {new Date(x.lastCompleted).toLocaleDateString()}</span>}
                      {x.assignee && <span className="text-xs text-steel">→ {x.assignee}</span>}
                    </div>
                    {x.notes && <p className="text-xs text-steel mt-1">{x.notes}</p>}
                  </div>
                  <ActionForm action={completeTask}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="id" value={x.id} />
                    <Submit quiet>Mark done</Submit>
                  </ActionForm>
                </div>
              </Card>
            );
          })}
        </div>
        <Card title="Schedule a recurring task" id="new-task">
          <ActionForm action={createTask} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Title</label><input className="input" name="title" required placeholder="e.g. Weekly layered process audit" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Repeats</label>
                <select className="input" name="recurrence" defaultValue="weekly">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                </select></div>
              <div><label className="label">First due</label><input className="input" name="nextDue" type="date" required /></div>
            </div>
            <div><label className="label">Assignee</label><input className="input" name="assignee" /></div>
            <div><label className="label">Notes</label><input className="input" name="notes" /></div>
            <Submit>Schedule</Submit>
            <p className="text-xs text-steel">Marking done advances the next occurrence automatically. Due and overdue tasks appear on the dashboard. Email reminders are on the Phase 2 roadmap.</p>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
