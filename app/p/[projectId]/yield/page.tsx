import { Card, PageHeader, EmptyState, Stat } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createYieldStream } from "@/app/actions2";
import AlertsBanner from "@/components/AlertsBanner";
import { getProject } from "@/lib/data";
import { fpy, rty, YieldEntry } from "@/lib/yield";
import { db, t } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function YieldList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const streams = (await db.select().from(t.streams).where(eq(t.streams.projectId, project.id)))
    .filter(s => s.type === "YIELD");
  const ptsByStream: Record<string, any[]> = {};
  if (streams.length) {
    const pts = await db.select().from(t.dataPoints)
      .where(inArray(t.dataPoints.streamId, streams.map(s => s.id)))
      .orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt));
    for (const p of pts) (ptsByStream[p.streamId] ??= []).push(p);
  }
  // RTY across stages = product of each stage's latest FPY (a stage = one yield stream).
  const latestFpys = streams
    .map(s => { const pts = ptsByStream[s.id] ?? []; return pts.length ? fpy(pts[pts.length - 1].payload as YieldEntry) : null; })
    .filter((x): x is number => x != null);
  const rtyVal = latestFpys.length >= 2 ? rty(latestFpys) : null;

  return (
    <div>
      <PageHeader eyebrow="Monitor & track" title="Yield / scrap" />
      <AlertsBanner projectId={project.id} sourceTypes={["YIELD"]} scopeLabel="this project's yield stages" inboxCategory="YIELD" />
      {rtyVal != null && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Rolled throughput yield" value={`${(rtyVal * 100).toFixed(1)}%`}
            tone={rtyVal >= 0.9 ? "ok" : "warn"}
            help="Product of each stage's latest first-pass yield — the chance a unit passes every stage first time. Each yield stage on this page counts as one stage." />
          <Stat label="Stages" value={String(streams.length)} />
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {streams.length === 0 ? (
            <EmptyState title="No yield stages yet"
              body="Log units started, units passed and scrap reasons per batch or day. First-pass yield is computed on every entry, scrap builds a live Pareto, and three consecutive entries below your threshold raise an alert automatically. Create one stage per process step to also get rolled throughput yield."
              cta={<Link className="btn" href="#new-yield">Create yield stage</Link>} />
          ) : streams.map(s => {
            const pts = ptsByStream[s.id] ?? [];
            const last = pts.length ? fpy(pts[pts.length - 1].payload as YieldEntry) : null;
            const threshold = s.target ?? 0.95;
            return (
              <Link key={s.id} href={`/p/${project.id}/yield/${s.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                <div>
                  <span className="font-semibold text-sm">{s.name}</span>
                  <span className="text-xs text-steel ml-2">{pts.length} entr{pts.length === 1 ? "y" : "ies"} · threshold {(threshold * 100).toFixed(0)}%</span>
                </div>
                <span className={`mono text-sm font-bold ${last == null ? "text-steel" : last < threshold ? "text-alarm" : "text-ok"}`}>
                  {last == null ? "no data" : `FPY ${(last * 100).toFixed(1)}%`}
                </span>
              </Link>
            );
          })}
        </div>
        <Card title="New yield stage" id="new-yield">
          <ActionForm action={createYieldStream} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Stage name</label><input className="input" name="name" required placeholder="e.g. Final assembly" data-kbd="new" /></div>
            <div><label className="label">FPY alert threshold (%)</label>
              <input className="input mono" name="threshold" type="number" step="any" min={1} max={100} defaultValue={95} />
              <p className="text-xs text-steel mt-1">An alert is raised after 3 consecutive entries below this — the same consecutive-run pattern the OEE module uses.</p></div>
            <Submit>Create stage</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
