import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import GanttChart from "@/components/charts/GanttChart";
import { getProject } from "@/lib/data";
import { cpm, CpmTask } from "@/lib/cpm";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GanttDetail({ params }: { params: { projectId: string; cpmId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [plan] = await db.select().from(t.cpmPlans).where(eq(t.cpmPlans.id, params.cpmId));
  if (!plan || plan.projectId !== project.id) notFound();
  const solved = cpm(plan.tasks as CpmTask[]);
  if (!solved.ok) {
    return (
      <div>
        <PageHeader eyebrow="Plan & schedule · CPM" title={plan.name} />
        <Card><p className="text-sm text-alarm">{solved.error}</p></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule · CPM" title={plan.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Project duration" value={String(solved.projectDuration)} help="Length of the longest dependency chain — the critical path." />
        <Stat label="Tasks" value={String(solved.tasks.length)} />
        <Stat label="On critical path" value={String(solved.criticalPath.length)} tone="warn" />
        <Stat label="Critical path" value={solved.criticalPath.join(" → ")} />
      </div>
      <Card title="Gantt (earliest-start schedule)">
        <GanttChart rows={solved.tasks.map(x => ({ key: x.key, name: x.name, es: x.es, duration: x.duration, slack: x.slack, critical: x.critical }))} />
        <p className="text-xs text-steel mt-2">Red bars are critical: any delay there delays the whole project one-for-one. The grey tail after a bar is its slack — how late it may finish (up to LF) without moving the end date.</p>
      </Card>
      <Card title="Schedule table" className="mt-4">
        <table className="data">
          <thead><tr><th>ID</th><th>Task</th><th>Dur</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>Slack</th><th></th></tr></thead>
          <tbody>
            {solved.tasks.map(x => (
              <tr key={x.key}>
                <td className="mono font-semibold">{x.key}</td>
                <td>{x.name}</td>
                <td className="mono">{x.duration}</td>
                <td className="mono">{x.es}</td><td className="mono">{x.ef}</td>
                <td className="mono">{x.ls}</td><td className="mono">{x.lf}</td>
                <td className="mono">{x.slack}</td>
                <td>{x.critical && <Badge tone="alarm">critical</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
