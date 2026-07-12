import AlertList from "@/components/AlertList";
import { Card, PageHeader, Stat } from "@/components/ui";
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
  const [alerts, streams, capas, tasks] = await Promise.all([
    openAlerts([project.id]),
    db.select().from(t.streams).where(eq(t.streams.projectId, project.id)),
    db.select().from(t.capas).where(eq(t.capas.projectId, project.id)).orderBy(desc(t.capas.updatedAt)),
    db.select().from(t.scheduledTasks).where(eq(t.scheduledTasks.projectId, project.id)),
  ]);
  const overdue = tasks.filter(x => new Date(x.nextDue).getTime() < Date.now()).length;
  const openCapas = capas.filter(c => c.status !== "closed" && c.status !== "verified");

  return (
    <div>
      <PageHeader eyebrow="Project overview" title={project.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Open alerts" value={String(alerts.length)} tone={alerts.length ? "warn" : "ok"} />
        <Stat label="Data streams" value={String(streams.length)} />
        <Stat label="Open CAPAs" value={String(openCapas.length)} tone={openCapas.length ? "warn" : "ok"} />
        <Stat label="Overdue tasks" value={String(overdue)} tone={overdue ? "alarm" : "ok"} />
      </div>
      <div id="alert-inbox">
        <Card title="Alert inbox">
          <AlertList alerts={alerts as any} initialCategory={searchParams.cat} />
        </Card>
      </div>
      <p className="text-xs text-steel mt-4">
        New here? Start with a <Link className="text-accent font-semibold" href={`/p/${project.id}/playbooks`}>guided playbook</Link> — it walks the whole DMAIC loop and records the team&apos;s decisions along the way.
      </p>
    </div>
  );
}
