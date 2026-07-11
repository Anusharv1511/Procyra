import AppShell from "@/components/AppShell";
import AlertList from "@/components/AlertList";
import { Card, PageHeader, Stat, EmptyState } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { myProjects, openAlerts, dueTasks } from "@/lib/data";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = await myProjects();
  if (!projects.length) redirect("/setup");
  const ids = projects.map(p => p.id);
  const [alerts, tasks] = await Promise.all([openAlerts(ids), dueTasks(ids)]);
  const names = Object.fromEntries(projects.map(p => [p.id, p.name]));
  const critical = alerts.filter(a => a.severity === "critical").length;

  return (
    <AppShell userName={user.name}>
      <PageHeader eyebrow="All projects" title="Dashboard" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Open alerts" value={String(alerts.length)} tone={alerts.length ? "warn" : "ok"} />
        <Stat label="Critical" value={String(critical)} tone={critical ? "alarm" : "ok"} />
        <Stat label="Tasks due ≤3 days" value={String(tasks.length)} tone={tasks.length ? "warn" : "ok"} />
        <Stat label="Projects" value={String(projects.length)} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Alert inbox">
            <AlertList alerts={alerts} projectNames={names} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Due & upcoming tasks">
            {tasks.length === 0 ? (
              <p className="text-sm text-steel">Nothing due in the next 3 days.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {tasks.map(x => {
                  const overdue = new Date(x.nextDue).getTime() < Date.now();
                  return (
                    <li key={x.id}>
                      <Link href={`/p/${x.projectId}/tasks`} className="hover:underline">
                        <span className={overdue ? "text-alarm font-semibold" : ""}>{x.title}</span>
                        <span className="text-steel"> — {new Date(x.nextDue).toLocaleDateString()}{overdue ? " (overdue)" : ""}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Projects">
            <ul className="space-y-1 text-sm">
              {projects.map(p => (
                <li key={p.id}>
                  <Link className="text-accent font-semibold hover:underline" href={`/p/${p.id}`}>{p.name}</Link>
                  <span className="text-steel"> · {p.workspace.name}</span>
                </li>
              ))}
            </ul>
            <Link href="/projects" className="btn btn-quiet mt-3">Manage projects</Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
