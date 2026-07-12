import AppShell from "@/components/AppShell";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createProject, seedDemoProject } from "@/app/actions";
import { seedSemiconductorProject, seedLogisticsProject } from "@/app/actions2";
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
  const isBrandNew = projects.length === 0 && archivedProjects.length === 0;

  const newProjectForm = (
    <ActionForm action={createProject} className="space-y-3">
      <div><label className="label" htmlFor="workspaceId">Workspace</label>
        <select className="input" id="workspaceId" name="workspaceId">
          {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select></div>
      <div><label className="label" htmlFor="pname">Name</label>
        <input className="input" id="pname" name="name" required placeholder="e.g. Pack line OEE push" /></div>
      <div><label className="label" htmlFor="pdesc">Description (optional)</label>
        <input className="input" id="pdesc" name="description" /></div>
      <Submit>{isBrandNew ? "Create your first project" : "Create project"}</Submit>
    </ActionForm>
  );

  // Part A1 — seeds a brand-new demo project (never touches existing ones)
  // with a full DMAIC scenario generated through the app's real rules engine.
  const loadExampleForm = (
    <div className="border-t border-line pt-3 mt-4">
      <p className="label">Load an example project</p>
      <div className="flex flex-wrap gap-2">
        <ActionForm action={seedDemoProject}>
          <Submit quiet>Automotive</Submit>
        </ActionForm>
        <ActionForm action={seedSemiconductorProject}>
          <Submit quiet>Semiconductor</Submit>
        </ActionForm>
        <ActionForm action={seedLogisticsProject}>
          <Submit quiet>Logistics</Submit>
        </ActionForm>
      </div>
      <p className="text-xs text-steel mt-2">
        Each creates a brand-new demo project (never touching existing ones) generated through the
        app&apos;s real rules engine: a completed DMAIC playbook, live SPC data with genuine
        out-of-control points, alerts, an auto-drafted CAPA and an FMEA — machining flange OD
        (automotive), etch critical dimension at Cpk 1.67 (semiconductor), or pick-station errors
        and OEE (logistics). Takes a few seconds.
      </p>
    </div>
  );

  // Fix 10 — open-alert count per project: same definition the dashboard's
  // "Open alerts" stat uses (status = 'open'), grouped per project. Plus a
  // per-project active-playbook count from the existing playbook_runs table.
  const alertCounts: Record<string, number> = {};
  const playbookCounts: Record<string, number> = {};
  // Part M — "last activity" per project: the most recent of any logged data
  // point, alert, defect or CAPA. Read-only aggregation over existing tables.
  const lastActivity: Record<string, Date> = {};
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

    const [dpLast, alLast, ncLast, capaLast] = await Promise.all([
      db.select({ projectId: t.streams.projectId, last: sql<string>`max(${t.dataPoints.createdAt})` })
        .from(t.dataPoints).innerJoin(t.streams, eq(t.streams.id, t.dataPoints.streamId))
        .where(inArray(t.streams.projectId, ids)).groupBy(t.streams.projectId),
      db.select({ projectId: t.alerts.projectId, last: sql<string>`max(${t.alerts.createdAt})` })
        .from(t.alerts).where(inArray(t.alerts.projectId, ids)).groupBy(t.alerts.projectId),
      db.select({ projectId: t.nonConformances.projectId, last: sql<string>`max(${t.nonConformances.createdAt})` })
        .from(t.nonConformances).where(inArray(t.nonConformances.projectId, ids)).groupBy(t.nonConformances.projectId),
      db.select({ projectId: t.capas.projectId, last: sql<string>`max(${t.capas.createdAt})` })
        .from(t.capas).where(inArray(t.capas.projectId, ids)).groupBy(t.capas.projectId),
    ]);
    for (const rows of [dpLast, alLast, ncLast, capaLast])
      for (const r of rows) {
        if (!r.last) continue;
        const d = new Date(r.last);
        if (!lastActivity[r.projectId] || d > lastActivity[r.projectId]) lastActivity[r.projectId] = d;
      }
  }

  const ago = (d?: Date) => {
    if (!d) return null;
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
  };

  if (isBrandNew) {
    return (
      <AppShell userName={user.name}>
        <PageHeader eyebrow="Workspaces & projects" title="Projects" />
        <div className="max-w-2xl mx-auto">
          <Card className="text-center">
            <h2 className="text-xl font-bold tracking-tight">Let&apos;s set up your first project</h2>
            <p className="text-sm text-steel mt-2 max-w-md mx-auto text-left sm:text-center">
              Procyra organizes work into projects. Inside a project, <span className="font-semibold text-ink">Guided Mode playbooks</span> walk
              you through a methodology like DMAIC step by step, opening the right tool (SPC, FMEA, OEE, and so on) exactly
              when you need it. If you already know what you&apos;re doing, you can also open any tool directly —
              no playbook required.
            </p>
            <div className="mt-6 max-w-sm mx-auto text-left" id="new-project">
              {newProjectForm}
              {loadExampleForm}
            </div>
          </Card>
        </div>
      </AppShell>
    );
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
            {listed.length === 0 ? (
              <EmptyState
                title={showArchived ? "No archived projects" : "All your projects are archived"}
                body={showArchived
                  ? "Nothing here yet. Archive a project from its ⋯ menu and it'll show up in this list."
                  : "Every project in this workspace is archived. Restore one from the archived list, or create a new project to get going again."}
                cta={showArchived
                  ? <Link href="/projects" className="btn btn-quiet">← Back to active projects</Link>
                  : <Link href="#new-project" className="btn">Create a project</Link>}
              />
            ) : (
              <table className="data">
                <thead><tr><th>Project</th><th>Workspace</th><th>Industry</th><th>Open alerts</th><th>Active playbooks</th><th>Last activity</th><th>Created</th><th></th></tr></thead>
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
                        <td className="text-steel text-xs">{ago(lastActivity[p.id]) ?? "—"}</td>
                        <td className="text-steel mono">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td><ProjectRowActions projectId={p.id} name={p.name} archived={showArchived} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {(archivedProjects.length > 0 || showArchived) && (
              <p className="text-xs mt-3">
                {showArchived
                  ? <Link href="/projects" className="text-accent font-semibold hover:underline">← Back to active projects</Link>
                  : <Link href="/projects?archived=1" className="text-steel hover:underline">Show archived ({archivedProjects.length})</Link>}
              </p>
            )}
          </Card>
        </div>
        <Card title="New project" id="new-project">
          {newProjectForm}
          {loadExampleForm}
          <p className="text-xs text-steel mt-3">Need a different industry or terminology? Workspaces are created on the setup page.</p>
          <Link href="/setup" className="btn btn-quiet mt-2">Manage workspaces →</Link>
        </Card>
      </div>
    </AppShell>
  );
}
