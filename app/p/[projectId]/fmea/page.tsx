import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createFmea } from "@/app/actions";
import { getProject } from "@/lib/data";
import { defaults } from "@/lib/terminology";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FmeaList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const d = defaults(project.workspace.industry);
  const fmeas = await db.select().from(t.fmeas).where(eq(t.fmeas.projectId, project.id));

  return (
    <div>
      <PageHeader eyebrow="Risk & compliance" title="FMEA" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {fmeas.length === 0 ? (
            <EmptyState title="No FMEAs yet"
              body="A living FMEA register: RPN is computed and the table re-sorted automatically on every edit, and items crossing your action threshold raise an alert." />
          ) : fmeas.map(f => (
            <Link key={f.id} href={`/p/${project.id}/fmea/${f.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
              <span className="font-semibold text-sm">{f.name}</span>
              <span className="text-xs text-steel mono">{f.type} · action ≥ {f.rpnAction}</span>
            </Link>
          ))}
        </div>
        <Card title="New FMEA">
          <ActionForm action={createFmea} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Name</label><input className="input" name="name" required placeholder="e.g. Final assembly PFMEA" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Type</label>
                <select className="input" name="type"><option>PFMEA</option><option>DFMEA</option></select></div>
              <div><label className="label">RPN action threshold</label>
                <input className="input mono" name="rpnAction" type="number" defaultValue={d.rpnActionThreshold} /></div>
            </div>
            <Submit>Create FMEA</Submit>
            <p className="text-xs text-steel">Default threshold {d.rpnActionThreshold} for your industry.</p>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
