import AlertList from "@/components/AlertList";
import { Card, PageHeader, Stat, ChecklistCard } from "@/components/ui";
import { getProject, openAlerts } from "@/lib/data";
import { db, t } from "@/db";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProjectOverview({ params, searchParams }: {
  params: { projectId: string }; searchParams: { cat?: string };
}) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [alerts, streams, capas, tasks, playbookRuns, ncs] = await Promise.all([
    openAlerts([project.id]),
    db.select().from(t.streams).where(eq(t.streams.projectId, project.id)),
    db.select().from(t.capas).where(eq(t.capas.projectId, project.id)).orderBy(desc(t.capas.updatedAt)),
    db.select().from(t.scheduledTasks).where(eq(t.scheduledTasks.projectId, project.id)),
    db.select().from(t.playbookRuns).where(eq(t.playbookRuns.projectId, project.id)),
    db.select().from(t.nonConformances).where(eq(t.nonConformances.projectId, project.id)),
  ]);
  const overdue = tasks.filter(x => new Date(x.nextDue).getTime() < Date.now()).length;
  const openCapas = capas.filter(c => c.status !== "closed" && c.status !== "verified");

  // Getting-started checklist: "done" is derived straight from existing tables
  // (one row = done), no new schema or tracked state. Card disappears once all
  // three are true — at that point the project has real data and the stats /
  // alert inbox above speak for themselves.
  const hasPlaybookRun = playbookRuns.length > 0;
  const hasSpcStream = streams.some(s => s.type.startsWith("SPC"));
  const hasDefectOrCapa = ncs.length > 0 || capas.length > 0;
  const showChecklist = !(hasPlaybookRun && hasSpcStream && hasDefectOrCapa);

  return (
    <div>
      <PageHeader eyebrow="Project overview" title={project.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Open alerts" value={String(alerts.length)} tone={alerts.length ? "warn" : "ok"} />
        <Stat label="Data streams" value={String(streams.length)} />
        <Stat label="Open CAPAs" value={String(openCapas.length)} tone={openCapas.length ? "warn" : "ok"} />
        <Stat label="Overdue tasks" value={String(overdue)} tone={overdue ? "alarm" : "ok"} />
      </div>
      {showChecklist && (
        <div className="mb-6">
          <ChecklistCard
            title="Getting started"
            items={[
              { label: "Start a guided playbook (recommended for first-time users)", href: `/p/${project.id}/playbooks`, done: hasPlaybookRun },
              { label: "Or, set up an SPC stream directly if you already know what you're measuring", href: `/p/${project.id}/spc`, done: hasSpcStream },
              { label: "Log your first defect or CAPA", href: `/p/${project.id}/nc`, done: hasDefectOrCapa },
            ]}
          />
        </div>
      )}
      <div id="alert-inbox">
        <Card title="Alert inbox">
          <AlertList alerts={alerts as any} initialCategory={searchParams.cat} />
        </Card>
      </div>
      {!showChecklist && (
        <p className="text-xs text-steel mt-4">
          New here? Start with a <Link className="text-accent font-semibold" href={`/p/${project.id}/playbooks`}>guided playbook</Link> — it walks the whole DMAIC loop and records the team&apos;s decisions along the way.
        </p>
      )}
    </div>
  );
}
