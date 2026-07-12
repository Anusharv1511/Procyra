import { Card, PageHeader, Stat } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addYieldEntry } from "@/app/actions2";
import ParetoChart from "@/components/charts/ParetoChart";
import TrendLine from "@/components/charts/TrendLine";
import { getProject } from "@/lib/data";
import { fpy, scrapPareto, YieldEntry } from "@/lib/yield";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function YieldDetail({ params }: { params: { projectId: string; streamId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [stream] = await db.select().from(t.streams).where(eq(t.streams.id, params.streamId));
  if (!stream || stream.projectId !== project.id || stream.type !== "YIELD") notFound();
  const pts = await db.select().from(t.dataPoints)
    .where(eq(t.dataPoints.streamId, stream.id)).orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt));
  const entries = pts.map(p => p.payload as YieldEntry);
  const threshold = stream.target ?? 0.95;
  const latest = entries.length ? fpy(entries[entries.length - 1]) : null;
  const totals = entries.reduce((a, e) => ({ started: a.started + e.started, passed: a.passed + e.passed }), { started: 0, passed: 0 });
  const pareto = scrapPareto(entries);
  const trend = pts.map((p, i) => ({
    label: new Date(p.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    fpy: Number((fpy(entries[i]) * 100).toFixed(2)),
  }));

  return (
    <div>
      <PageHeader eyebrow="Monitor & track · yield" title={stream.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Latest FPY" value={latest != null ? `${(latest * 100).toFixed(1)}%` : "—"}
          tone={latest == null ? undefined : latest < threshold ? "alarm" : "ok"} />
        <Stat label="Cumulative FPY" value={totals.started ? `${((totals.passed / totals.started) * 100).toFixed(1)}%` : "—"} />
        <Stat label="Threshold" value={`${(threshold * 100).toFixed(0)}%`} />
        <Stat label="Entries" value={String(entries.length)} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {trend.length > 1 && (
            <Card title="First-pass yield trend">
              <TrendLine data={trend} unit="%" series={[{ key: "fpy", label: "FPY %", color: "var(--accent)" }]} />
            </Card>
          )}
          {pareto.length > 0 && (
            <Card title="Scrap Pareto by reason">
              <ParetoChart data={pareto} />
            </Card>
          )}
          <Card title="Entries">
            <table className="data">
              <thead><tr><th>Date</th><th>Started</th><th>Passed</th><th>FPY</th><th>Scrap reasons</th></tr></thead>
              <tbody>
                {pts.slice().reverse().map((p, i) => {
                  const e = p.payload as YieldEntry;
                  const f = fpy(e);
                  return (
                    <tr key={p.id}>
                      <td className="mono text-xs">{new Date(p.ts).toLocaleDateString()}</td>
                      <td className="mono">{e.started}</td>
                      <td className="mono">{e.passed}</td>
                      <td className={`mono font-semibold ${f < threshold ? "text-alarm" : "text-ok"}`}>{(f * 100).toFixed(1)}%</td>
                      <td className="text-xs text-steel">{(e.scrap ?? []).map(sc => `${sc.reason} ×${sc.qty}`).join(", ") || "—"}</td>
                    </tr>
                  );
                })}
                {!pts.length && <tr><td colSpan={5} className="text-steel">Log the first entry.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
        <Card title="Log entry">
          <ActionForm action={addYieldEntry} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="streamId" value={stream.id} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Units started</label><input className="input mono" name="started" type="number" required min={1} data-kbd="new" /></div>
              <div><label className="label">Units passed</label><input className="input mono" name="passed" type="number" required min={0} /></div>
            </div>
            <div><label className="label">Scrap reasons (one per line, &quot;reason: qty&quot;)</label>
              <textarea className="input mono text-xs" name="scrap" rows={4} placeholder={"OD oversize: 3\nPorosity: 1"} />
              <p className="text-xs text-steel mt-1">Quantity defaults to 1 if omitted. These feed the scrap Pareto.</p></div>
            <Submit>Log entry</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
