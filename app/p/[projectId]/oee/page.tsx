import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createStream } from "@/app/actions";
import { getProject } from "@/lib/data";
import { defaults, terms } from "@/lib/terminology";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OeeList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const d = defaults(project.workspace.industry);
  const T = terms(project.workspace.industry);
  const streams = (await db.select().from(t.streams).where(eq(t.streams.projectId, project.id)))
    .filter(s => s.type === "OEE");

  return (
    <div>
      <PageHeader eyebrow="Monitor & track" title="OEE" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {streams.length === 0 ? (
            <EmptyState title="No OEE logs yet"
              body={`Create one log per ${T.line.toLowerCase()} or asset. Log a daily entry (planned time, run time, ideal cycle time, total and good ${T.units.toLowerCase()}) — availability, performance, quality and OEE compute automatically, and a run below target raises an alert.`} />
          ) : streams.map(s => (
            <Link key={s.id} href={`/p/${project.id}/oee/${s.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
              <span className="font-semibold text-sm">{s.name}</span>
              <span className="text-xs text-steel mono">target {(100 * (s.target ?? 0.85)).toFixed(0)}%</span>
            </Link>
          ))}
        </div>
        <Card title={`New OEE log (${T.line.toLowerCase()} / asset)`}>
          <ActionForm action={createStream} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="type" value="OEE" />
            <div><label className="label">Name</label>
              <input className="input" name="name" required placeholder={`e.g. ${T.line} 4`} /></div>
            <div><label className="label">OEE target (fraction)</label>
              <input className="input" name="target" type="number" step="0.01" min="0" max="1" defaultValue={d.oeeTarget} />
              <p className="text-xs text-steel mt-1">Default {(d.oeeTarget * 100).toFixed(0)}% for your industry. Three consecutive entries below target raise an alert.</p></div>
            <Submit>Create log</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
