import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createCapa, updateCapa } from "@/app/actions";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "open", "in_progress", "closed", "verified"];
const statusTone = (s: string) =>
  (s === "draft" ? ("warn" as const) : s === "closed" || s === "verified" ? ("ok" as const) : ("accent" as const));

export default async function CapaPage({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const capas = await db.select().from(t.capas)
    .where(eq(t.capas.projectId, project.id)).orderBy(desc(t.capas.updatedAt));

  return (
    <div>
      <PageHeader eyebrow="Monitor & track" title="CAPA register" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {capas.length === 0 && (
            <EmptyState title="No CAPAs yet"
              body="Create one below, or let the app draft one for you automatically when a defect recurs."
              cta={<Link className="btn" href="#new-capa">Create CAPA</Link>} />
          )}
          {capas.map(c => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <span className="font-semibold text-sm">{c.title}</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge tone={statusTone(c.status)}>{c.status.replace("_", " ")}</Badge>
                    {c.source === "auto" && <Badge tone="warn">auto-drafted — review me</Badge>}
                    {c.linkedDefectCode && <Badge tone="quiet">↔ {c.linkedDefectCode}</Badge>}
                  </div>
                </div>
                <span className="text-xs text-steel mono">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </div>
              <details className="mt-3">
                <summary className="text-sm text-accent font-semibold cursor-pointer">Update</summary>
                <ActionForm action={updateCapa} className="space-y-3 mt-3">
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="id" value={c.id} />
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Status</label>
                      <select className="input" name="status" defaultValue={c.status}>
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select></div>
                    <div><label className="label">Owner</label><input className="input" name="owner" defaultValue={c.owner ?? ""} /></div>
                  </div>
                  <div><label className="label">Root cause</label><textarea className="input" name="rootCause" rows={2} defaultValue={c.rootCause ?? ""} /></div>
                  <div><label className="label">Corrective action</label><textarea className="input" name="correctiveAction" rows={2} defaultValue={c.correctiveAction ?? ""} /></div>
                  <div><label className="label">Preventive action</label><textarea className="input" name="preventiveAction" rows={2} defaultValue={c.preventiveAction ?? ""} /></div>
                  <Submit>Save</Submit>
                </ActionForm>
              </details>
            </Card>
          ))}
        </div>
        <Card title="New CAPA" id="new-capa">
          <ActionForm action={createCapa} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Title</label><input className="input" name="title" required /></div>
            <div><label className="label">Owner</label><input className="input" name="owner" /></div>
            <div><label className="label">Linked defect code (optional)</label><input className="input" name="linkedDefectCode" /></div>
            <div><label className="label">Due date</label><input className="input" name="dueDate" type="date" /></div>
            <Submit>Create CAPA</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
