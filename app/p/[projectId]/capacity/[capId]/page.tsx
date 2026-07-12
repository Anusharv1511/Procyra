import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import StationChart from "@/components/charts/StationChart";
import { getProject } from "@/lib/data";
import { capacityAnalysis, CapacityStep } from "@/lib/capacity";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CapacityDetail({ params }: { params: { projectId: string; capId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [cs] = await db.select().from(t.capacityStudies).where(eq(t.capacityStudies.id, params.capId));
  if (!cs || cs.projectId !== project.id) notFound();
  const steps = cs.steps as CapacityStep[];
  const r = capacityAnalysis(steps);
  const lb = cs.sourceLineBalanceId
    ? (await db.select().from(t.lineBalances).where(eq(t.lineBalances.id, cs.sourceLineBalanceId)))[0]
    : null;

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule · capacity" title={cs.name} />
      {lb && <p className="text-xs text-steel mb-3">Steps imported from line-balance study <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/linebalance/${lb.id}`}>{lb.name}</Link> (snapshot — edits there don&apos;t change this study).</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Line capacity" value={`${r.lineCapacity.toFixed(0)} u/period`}
          help="The bottleneck's capacity — the most the whole line can sustain, whatever the other steps could do." />
        <Stat label="Bottleneck" value={r.bottleneck?.name ?? "—"} tone={r.bottleneck ? "warn" : undefined} />
        <Stat label="Steps" value={String(steps.length)} />
        <Stat label="Spare at best step" value={r.steps.length ? `${(Math.max(...r.steps.map(s => s.capacity)) - r.lineCapacity).toFixed(0)} u` : "—"}
          help="Capacity gap between the fastest and slowest step — potential unlocked if the bottleneck were raised to match." />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Capacity by step (units/period)">
            <StationChart
              data={r.steps.map(s => ({ name: s.name, value: Number(s.capacity.toFixed(1)), flagged: s.isBottleneck }))}
              refValue={r.lineCapacity} refLabel={`Line ${r.lineCapacity.toFixed(0)}`} unit="u" />
            <p className="text-xs text-steel mt-2">The red bar is the bottleneck. An hour lost there is an hour lost for the whole line; an hour saved anywhere else changes nothing until the bottleneck moves.</p>
          </Card>
        </div>
        <Card title="Step detail">
          <table className="data">
            <thead><tr><th>Step</th><th>Cycle</th><th>Avail</th><th>Capacity</th><th></th></tr></thead>
            <tbody>
              {r.steps.map(s => (
                <tr key={s.name}>
                  <td className="font-medium">{s.name}</td>
                  <td className="mono">{s.cycleTime}</td>
                  <td className="mono">{s.availableTime}</td>
                  <td className="mono font-semibold">{s.capacity.toFixed(1)}</td>
                  <td>{s.isBottleneck && <Badge tone="alarm">bottleneck</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-steel mt-2">Utilization at demand = demand ÷ capacity per step; the bottleneck runs hottest by definition.</p>
        </Card>
      </div>
    </div>
  );
}
