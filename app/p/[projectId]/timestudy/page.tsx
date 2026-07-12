import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createTimeStudy } from "@/app/actions";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TimeStudyList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const studies = await db.select().from(t.timeStudies).where(eq(t.timeStudies.projectId, project.id));

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze" title="Time study & standard time" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {studies.length === 0 ? (
            <EmptyState title="No time studies yet"
              body="Break the job into elements, record observed times and a performance rating per element — normal time, PFD-allowed standard time, and a learning-curve projection compute automatically."
              cta={<Link className="btn" href="#new-time-study">Create time study</Link>} />
          ) : studies.map(s => (
            <Link key={s.id} href={`/p/${project.id}/timestudy/${s.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
              <span className="font-semibold text-sm">{s.name}</span>
              <span className="text-xs text-steel mono">PFD {s.personalPct + s.fatiguePct + s.delayPct}% · LC {s.learningCurvePct}%</span>
            </Link>
          ))}
        </div>
        <Card title="New time study" id="new-time-study">
          <ActionForm action={createTimeStudy} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Job / operation name</label><input className="input" name="name" required /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label">Personal %</label><input className="input mono" name="personalPct" type="number" step="0.5" defaultValue={5} /></div>
              <div><label className="label">Fatigue %</label><input className="input mono" name="fatiguePct" type="number" step="0.5" defaultValue={4} /></div>
              <div><label className="label">Delay %</label><input className="input mono" name="delayPct" type="number" step="0.5" defaultValue={3} /></div>
            </div>
            <div><label className="label">Learning curve rate %</label>
              <input className="input mono" name="learningCurvePct" type="number" min={50} max={100} defaultValue={90} />
              <p className="text-xs text-steel mt-1">90% means each doubling of cumulative units takes 90% of the previous per-unit time.</p></div>
            <Submit>Create study</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
