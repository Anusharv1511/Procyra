import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { create8D } from "@/app/actions2";
import { getProject } from "@/lib/data";
import { terms } from "@/lib/terminology";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EightDList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const T = terms(project.workspace.industry);
  const [records, capas, ncs] = await Promise.all([
    db.select().from(t.eightDs).where(eq(t.eightDs.projectId, project.id)).orderBy(desc(t.eightDs.createdAt)),
    db.select().from(t.capas).where(eq(t.capas.projectId, project.id)),
    db.select().from(t.nonConformances).where(eq(t.nonConformances.projectId, project.id)),
  ]);
  const defectCodes = Array.from(new Set(ncs.map(n => n.defectCode)));

  return (
    <div>
      <PageHeader eyebrow="Risk & compliance" title="8D problem solving" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {records.length === 0 ? (
            <EmptyState title="No 8D records yet"
              body="8D is the structured team problem-solving format many customers (especially automotive) require: from forming the team (D1) through containment (D3), root cause (D4), corrective action (D5–D6), prevention (D7) and closing the loop (D8). Work each discipline in order; the record advances step by step."
              cta={<Link className="btn" href="#new-8d">Start an 8D</Link>} />
          ) : records.map(r => (
            <Link key={r.id} href={`/p/${project.id}/8d/${r.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
              <div>
                <span className="font-semibold text-sm">{r.title}</span>
                {r.linkedDefectCode && <span className="text-xs text-steel ml-2 mono">{r.linkedDefectCode}</span>}
              </div>
              <Badge tone={r.status === "closed" ? "ok" : "accent"}>
                {r.status === "closed" ? "Closed" : `At D${r.currentStep}`}
              </Badge>
            </Link>
          ))}
        </div>
        <Card title="Start an 8D" id="new-8d">
          <ActionForm action={create8D} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Title</label><input className="input" name="title" required placeholder="e.g. Customer return — flange leak" data-kbd="new" /></div>
            <div><label className="label">Link to CAPA (optional, traceability)</label>
              <select className="input" name="linkedCapaId">
                <option value="">— none —</option>
                {capas.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select></div>
            <div><label className="label">Link to {T.defect.toLowerCase()} code (optional)</label>
              <select className="input" name="linkedDefectCode">
                <option value="">— none —</option>
                {defectCodes.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <Submit>Start 8D</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
