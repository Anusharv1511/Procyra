import { Card, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addOeePoint } from "@/app/actions";
import OeeTrend from "@/components/charts/OeeTrend";
import AlertsBanner from "@/components/AlertsBanner";
import HelpTip from "@/components/HelpTip";
import { GLOSSARY } from "@/lib/glossary";
import Gauge from "@/components/charts/Gauge";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { oee } from "@/lib/spc";

export const dynamic = "force-dynamic";

export default async function OeeDetail({ params }: { params: { projectId: string; streamId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [stream] = await db.select().from(t.streams).where(eq(t.streams.id, params.streamId));
  if (!stream || stream.projectId !== project.id || stream.type !== "OEE") notFound();
  const pts = await db.select().from(t.dataPoints)
    .where(eq(t.dataPoints.streamId, stream.id)).orderBy(asc(t.dataPoints.ts));
  const target = stream.target ?? 0.85;
  const rows = pts.map(p => ({
    label: new Date(p.ts).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
    ...oee(p.payload as any),
  }));
  const latest = rows[rows.length - 1];

  return (
    <div>
      <PageHeader eyebrow="Monitor & track · OEE" title={stream.name} />
      <AlertsBanner projectId={project.id} streamId={stream.id} scopeLabel="this OEE log" inboxCategory="OEE" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Trend">
            {rows.length ? (
              <OeeTrend data={rows} target={target} />
            ) : <p className="text-sm text-steel">Log your first entry to start the trend.</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Latest">
            {latest ? (
              <>
                <Gauge value={latest.oee} target={target} label="OEE" />
                <p className="text-xs text-steel mt-1">OEE<HelpTip text={GLOSSARY.oee} term="OEE" /></p>
                <dl className="text-sm mt-2 space-y-1">
                  <div className="flex justify-between"><dt className="text-steel">Availability<HelpTip text={GLOSSARY.availability} term="Availability" /></dt><dd className="mono">{(latest.availability * 100).toFixed(1)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-steel">Performance<HelpTip text={GLOSSARY.performance} term="Performance" /></dt><dd className="mono">{(latest.performance * 100).toFixed(1)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-steel">Quality<HelpTip text={GLOSSARY.quality} term="Quality" /></dt><dd className="mono">{(latest.quality * 100).toFixed(1)}%</dd></div>
                </dl>
              </>
            ) : <p className="text-sm text-steel">No entries yet.</p>}
          </Card>
          <Card title="Log an entry">
            <ActionForm action={addOeePoint} className="space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="streamId" value={stream.id} />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Planned time (min)</label><input className="input mono" name="planned" type="number" step="any" required /></div>
                <div><label className="label">Run time (min)</label><input className="input mono" name="runtime" type="number" step="any" required /></div>
              </div>
              <div><label className="label">Ideal cycle time (min/unit)</label><input className="input mono" name="idealCycle" type="number" step="any" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Total count</label><input className="input mono" name="total" type="number" step="1" required /></div>
                <div><label className="label">Good count</label><input className="input mono" name="good" type="number" step="1" required /></div>
              </div>
              <Submit>Log entry</Submit>
              <p className="text-xs text-steel">A×P×Q computes on entry; {`${(target * 100).toFixed(0)}%`} is the alert target.</p>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
