import AppShell from "@/components/AppShell";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createProject } from "@/app/actions";
import { getSessionUser } from "@/lib/auth";
import { myProjects, myWorkspaces } from "@/lib/data";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Projects() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [projects, workspaces] = await Promise.all([myProjects(), myWorkspaces()]);
  if (!workspaces.length) redirect("/setup");

  return (
    <AppShell userName={user.name}>
      <PageHeader eyebrow="Workspaces & projects" title="Projects" />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Card>
            <table className="data">
              <thead><tr><th>Project</th><th>Workspace</th><th>Industry</th><th>Created</th></tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td><Link className="text-accent font-semibold hover:underline" href={`/p/${p.id}`}>{p.name}</Link></td>
                    <td>{p.workspace.name}</td>
                    <td className="text-steel">{p.workspace.industry.replace("_", " ")}</td>
                    <td className="text-steel mono">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <p className="text-xs text-steel mt-3">Need a different industry or terminology? Create a new workspace from <Link href="/setup" className="text-accent">setup</Link>.</p>
        </Card>
      </div>
    </AppShell>
  );
}
