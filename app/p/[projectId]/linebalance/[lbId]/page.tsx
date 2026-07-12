import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveLineBalanceStations } from "@/app/actions2";
import JsonRowsInput from "@/components/JsonRowsInput";
import StationChart from "@/components/charts/StationChart";
import { getProject } from "@/lib/data";
import { lineBalance } from "@/lib/linebalance";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LineBalanceDetail({ params }: { params: { projectId: string; lbId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [lb] = await db.select().from(t.lineBalances).where(eq(t.lineBalances.id, params.lbId));
  if (!lb || lb.projectId !== project.id) notFound();
  const stations = (lb.stations as { name: string; cycleTime: number }[]) ?? [];
  const r = lineBalance(lb.availableTime, lb.requiredOutput, stations);
  const anyOver = r.stations.some(s => s.overTakt);

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule · line balancing" title={lb.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Takt time" value={`${r.takt.toFixed(2)} min`} help="Available time ÷ required output — the drumbeat demand sets. Any station slower than this cannot keep up." />
        <Stat label="Line efficiency" value={stations.length ? `${r.efficiencyPct.toFixed(1)}%` : "—"} tone={stations.length ? (r.efficiencyPct >= 85 ? "ok" : "warn") : undefined}
          help="Σ station times ÷ (stations × slowest station). The rest is balance delay — paid time spent waiting." />
        <Stat label="Balance delay" value={stations.length ? `${r.balanceDelayPct.toFixed(1)}%` : "—"} />
        <Stat label="Min stations (theory)" value={stations.length ? String(r.theoreticalMinStations) : "—"}
          help="⌈total work ÷ takt⌉ — the fewest stations that could theoretically hold this work content at this demand." />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {stations.length > 0 && (
            <Card title="Cycle time by station vs takt">
              <StationChart
                data={r.stations.map(s => ({ name: s.name, value: s.cycleTime, flagged: s.overTakt }))}
                refValue={r.takt} refLabel={`Takt ${r.takt.toFixed(1)}`} unit="min" />
              {anyOver
                ? <p className="text-xs text-alarm font-medium mt-2">Red stations exceed takt — demand cannot be met there. Rebalance work off them, add capacity, or reduce their cycle time. An alert has been raised.</p>
                : <p className="text-xs text-steel mt-2">All stations are within takt. Max sustainable output at the current bottleneck: <span className="mono font-semibold">{r.maxOutputPerPeriod.toFixed(0)} units/period</span>.</p>}
            </Card>
          )}
          {stations.length > 0 && (
            <Card title="Station detail">
              <table className="data">
                <thead><tr><th>Station</th><th>Cycle (min)</th><th>Utilization</th><th>Idle/cycle (min)</th><th></th></tr></thead>
                <tbody>
                  {r.stations.map(s => (
                    <tr key={s.name}>
                      <td className="font-medium">{s.name}</td>
                      <td className="mono">{s.cycleTime.toFixed(2)}</td>
                      <td className="mono">{s.utilizationPct.toFixed(0)}%</td>
                      <td className="mono">{s.idle.toFixed(2)}</td>
                      <td className="space-x-1">
                        {s.isBottleneck && <Badge tone="warn">bottleneck</Badge>}
                        {s.overTakt && <Badge tone="alarm">over takt</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
        <Card title="Stations & cycle times">
          <ActionForm action={saveLineBalanceStations} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="id" value={lb.id} />
            <JsonRowsInput name="rows" addLabel="+ Add station" min={1}
              columns={[
                { key: "name", label: "Station", placeholder: "e.g. S1 — Frame" },
                { key: "cycleTime", label: "Cycle (min)", type: "number", width: "90px", placeholder: "1.2" },
              ]}
              initial={stations.map(s => ({ name: s.name, cycleTime: String(s.cycleTime) }))} />
            <Submit>Save stations</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">Cycle time = work content at that station per unit, same unit as available time (minutes). Tip: reuse these stations in <Link href={`/p/${project.id}/capacity`} className="text-accent font-semibold hover:underline">Capacity &amp; bottlenecks</Link>.</p>
        </Card>
      </div>
    </div>
  );
}
