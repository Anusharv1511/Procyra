import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createStream } from "@/app/actions";
import NewSpcStreamFields from "@/components/NewSpcStreamFields";
import AlertsBanner from "@/components/AlertsBanner";
import { getProject } from "@/lib/data";
import { defaults } from "@/lib/terminology";
import { db, t } from "@/db";
import { eq, inArray, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SpcList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const d = defaults(project.workspace.industry);
  const streams = await db.select().from(t.streams).where(eq(t.streams.projectId, project.id));
  const spcStreams = streams.filter(s => s.type.startsWith("SPC"));
  const staleCutoffs: Record<string, number> = { daily: 1.5, weekly: 8, monthly: 32 };
  const lastByStream: Record<string, Date | null> = {};
  if (spcStreams.length) {
    const pts = await db.select().from(t.dataPoints)
      .where(inArray(t.dataPoints.streamId, spcStreams.map(s => s.id)))
      .orderBy(desc(t.dataPoints.ts));
    for (const s of spcStreams) lastByStream[s.id] = pts.find(p => p.streamId === s.id)?.ts ?? null;
  }

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze" title="Control charts (SPC)" />
      <AlertsBanner projectId={project.id} sourceTypes={["SPC"]} scopeLabel="this project's SPC streams" inboxCategory="SPC" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {spcStreams.length === 0 ? (
            <EmptyState title="No SPC streams yet"
              body="Create a stream for each measured characteristic (a dimension, a weight, a temperature). Log measurements as they happen — the app evaluates Western Electric rules on every entry and flags out-of-control points automatically."
              cta={<Link className="btn" href="#new-stream">Create SPC stream</Link>} />
          ) : spcStreams.map(s => {
            const last = lastByStream[s.id];
            const stale = last ? (Date.now() - +new Date(last)) / 86400000 > (staleCutoffs[s.cadence] ?? 1.5) : true;
            return (
              <Link key={s.id} href={`/p/${project.id}/spc/${s.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                <div>
                  <span className="font-semibold text-sm">{s.name}</span>
                  <span className="text-xs text-steel ml-2">{s.type === "SPC_XBAR_R" ? `X̄-R (n=${s.subgroupSize})` : "I-MR"}{s.unit ? ` · ${s.unit}` : ""}</span>
                </div>
                <div className="flex gap-2 items-center">
                  {stale && <Badge tone="warn">stale — expected {s.cadence}</Badge>}
                  <span className="text-xs text-steel mono">{last ? new Date(last).toLocaleDateString() : "no data"}</span>
                </div>
              </Link>
            );
          })}
        </div>
        <Card title="New SPC stream" id="new-stream">
          <ActionForm action={createStream} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <NewSpcStreamFields />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Spec low (LSL)</label><input className="input" name="specLow" type="number" step="any" /></div>
              <div><label className="label">Spec high (USL)</label><input className="input" name="specHigh" type="number" step="any" /></div>
            </div>
            <div><label className="label">Cpk alert threshold</label>
              <input className="input" name="cpkThreshold" type="number" step="0.01" defaultValue={d.cpkThreshold} />
              <p className="text-xs text-steel mt-1">Default {d.cpkThreshold} for your industry. An alert is raised when capability drops below this.</p>
              <p className="text-xs text-steel mt-1">This alert tracks Cpk (short-term/within); Ppk (overall) is shown for reference but does not trigger an alert.</p></div>
            <Submit>Create stream</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
