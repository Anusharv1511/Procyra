import AppShell from "@/components/AppShell";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createProject } from "@/app/actions";
import ProjectRowActions from "@/components/ProjectRowActions";
import { getSessionUser } from "@/lib/auth";
import { myProjects, myWorkspaces } from "@/lib/data";
import { db, t } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Projects({ searchParams }: { searchParams: { archived?: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const showArchived = searchParams.archived === "1";
  const [projects, workspaces, archivedProjects] = await Promise.all([
    myProjects(), myWorkspaces(), myProjects({ archived: true }),
  ]);
  if (!workspaces.length) redirect("/setup");
  const listed = showArchived ? archivedProjects : projects;
  const ids = listed.map(p => p.id);

  // Fix 10 — open-alert count per project: same definition the dashboard's
  // "Open alerts" stat uses (status = 'open'), grouped per project. Plus a
  // per-project active-playbook count from the existing playbook_runs table.
  const alertCounts: Record<string, number> = {};
  const playbookCounts: Record<string, number> = {};
  if (ids.length) {
    const [aRows, pRows] = await Promise.all([
      db.select({ projectId: t.alerts.projectId, n: sql<number>`count(*)` })
        .from(t.alerts)
        .where(and(inArray(t.alerts.projectId, ids), eq(t.alerts.status, "open")))
        .groupBy(t.alerts.projectId),
      db.select({ projectId: t.playbookRuns.projectId, n: sql<number>`count(*)` })
        .from(t.playbookRuns)
        .where(and(inArray(t.playbookRuns.projectId, ids), eq(t.playbookRuns.status, "active")))
        .groupBy(t.playbookRuns.projectId),
    ]);
    for (const r of aRows) alertCounts[r.projectId] = Number(r.n);
    for (const r of pRows) playbookCounts[r.projectId] = Number(r.n);
  }

  return (
    <AppShell userName={user.name}>
      <PageHeader eyebrow="Workspaces & projects" title="Projects" />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Card>
            {showArchived && (
              <p className="text-xs text-steel mb-2">Archived projects — hidden from the dashboard and default lists, but nothing is deleted. Restore any of them from the ⋯ menu.</p>
            )}
            <table className="data">
              <thead><tr><th>Project</th><th>Workspace</th><th>Industry</th><th>Open alerts</th><th>Active playbooks</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {listed.map(p => {
                  const nAlerts = alertCounts[p.id] ?? 0;
                  const nRuns = playbookCounts[p.id] ?? 0;
                  return (
                    <tr key={p.id}>
                      <td><Link className="text-accent font-semibold hover:underline" href={`/p/${p.id}`}>{p.name}</Link></td>
                      <td>{p.workspace.name}</td>
                      <td className="text-steel">{p.workspace.industry.replace("_", " ")}</td>
                      <td className="mono">
                        {nAlerts > 0
                          ? <Link href={`/p/${p.id}#alert-inbox`} className="font-bold text-warn hover:underline">{nAlerts}</Link>
                          : <span className="text-steel">0</span>}
                      </td>
                      <td className="mono">
                        {nRuns > 0
                          ? <Link href={`/p/${p.id}/playbooks`} className="font-semibold text-accent hover:underline">{nRuns}</Link>
                          : <span className="text-steel">0</span>}
                      </td>
                      <td className="text-steel mono">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td><ProjectRowActions projectId={p.id} name={p.name} archived={showArchived} /></td>
                    </tr>
                  );
                })}
                {!listed.length && (
                  <tr><td colSpan={7} className="text-steel">
                    {showArchived ? "No archived projects." : "No projects yet — create one on the right."}
                  </td></tr>
                )}
              </tbody>
            </table>
            {(archivedProjects.length > 0 || showArchived) && (
              <p className="text-xs mt-3">
                {showArchived
                  ? <Link href="/projects" className="text-accent font-semibold hover:underline">← Back to active projects</Link>
                  : <Link href="/projects?archived=1" className="text-steel hover:underline">Show archived ({archivedProjects.length})</Link>}
              </p>
            )}
          </Card>
        </div>
        <Card title="New project">
          <ActionForm action={createProject} className="space-y-3">
            <div><label className="label" htmlFor="workspaceId">Workspace</label>
              <select className="input" id="workspaceId" name="workspaceId">
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select></div>
            <div><label className="label" htmlFor="pname">Name</label>
              <input className="input" id="pname" name="name" required placeholder="e.g. Pack line OEE push" /></div>
            <div><label className="label" htmlFor="pdesc">Description (optional)</label>
              <input className="input" id="pdesc" name="description" /></div>
            <Submit>Create project</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">Need a different industry or terminology? Workspaces are created on the setup page.</p>
          <Link href="/setup" className="btn btn-quiet mt-2">Manage workspaces →</Link>
        </Card>
      </div>
    </AppShell>
  );
}
