import AlertList from "@/components/AlertList";
import ShareLinkCard from "@/components/ShareLinkCard";
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

  // Part M — project completeness: share of module families with at least one
  // row of real data. Derived read-only from existing tables on each load.
  const [fmeaN, tsN, grrN, lbN, doeN, coN, spN, cpN, edN, auN, capN, skuN, cpmN] = await Promise.all([
    t.fmeas, t.timeStudies, t.gageStudies, t.lineBalances, t.doeStudies, t.changeovers,
    t.samplingPlans, t.controlPlanItems, t.eightDs, t.auditRuns, t.capacityStudies, t.skus, t.cpmPlans,
  ].map(tbl => db.select({ id: (tbl as any).id }).from(tbl as any).where(eq((tbl as any).projectId, project.id)).limit(1)));
  const moduleFlags: [string, boolean][] = [
    ["Playbooks", playbookRuns.length > 0],
    ["SPC", streams.some(s => s.type.startsWith("SPC"))],
    ["OEE", streams.some(s => s.type === "OEE")],
    ["Yield", streams.some(s => s.type === "YIELD")],
    ["Defects", ncs.length > 0],
    ["CAPA", capas.length > 0],
    ["FMEA", fmeaN.length > 0],
    ["Time study", tsN.length > 0],
    ["Gage R&R", grrN.length > 0],
    ["Line balance", lbN.length > 0],
    ["DOE", doeN.length > 0],
    ["SMED", coN.length > 0],
    ["Sampling", spN.length > 0],
    ["Control plan", cpN.length > 0],
    ["8D", edN.length > 0],
    ["Audit", auN.length > 0],
    ["Capacity", capN.length > 0],
    ["Inventory", skuN.length > 0],
    ["CPM", cpmN.length > 0],
    ["Tasks", tasks.length > 0],
  ];
  const usedCount = moduleFlags.filter(([, v]) => v).length;
  const completenessPct = Math.round((usedCount / moduleFlags.length) * 100);
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
      {usedCount > 0 && (
        <div className="card px-4 py-3 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="eyebrow">Project completeness — {usedCount} of {moduleFlags.length} modules in use ({completenessPct}%)</span>
            <span className="flex flex-wrap gap-1">
              {moduleFlags.map(([name, used]) => (
                <span key={name} title={name}
                  className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${used ? "bg-green-50 text-ok border-green-200" : "bg-gray-50 text-steel border-line opacity-60"}`}>
                  {name}
                </span>
              ))}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--line)] overflow-hidden" aria-hidden>
            <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${completenessPct}%` }} />
          </div>
        </div>
      )}
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
      {/* Part A2 — public read-only share link for this project */}
      <div className="mt-6 no-print">
        <Card title="Share (read-only)">
          <ShareLinkCard projectId={project.id} shareToken={project.shareToken} />
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
