import { Card, PageHeader, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addNc } from "@/app/actions";
import ParetoChart from "@/components/charts/ParetoChart";
import DownloadCsvButton from "@/components/DownloadCsvButton";
import ImportNcCsv from "@/components/ImportNcCsv";
import { getProject } from "@/lib/data";
import { terms, defaults } from "@/lib/terminology";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NcPage({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const T = terms(project.workspace.industry);
  const d = defaults(project.workspace.industry);
  const ncs = await db.select().from(t.nonConformances)
    .where(eq(t.nonConformances.projectId, project.id))
    .orderBy(desc(t.nonConformances.date));

  // Pareto: aggregate by code, sort descending server-side, cumulative on sorted order.
  const byCode = new Map<string, number>();
  for (const n of ncs) byCode.set(n.defectCode, (byCode.get(n.defectCode) ?? 0) + n.qty);
  const sorted = [...byCode.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((a, [, c]) => a + c, 0);
  let cum = 0;
  const pareto = sorted.map(([category, count]) => {
    cum += count;
    return { category, count, cumPct: total ? (100 * cum) / total : 0 };
  });

  const sevTone = (s: string) => (s === "critical" ? ("alarm" as const) : s === "major" ? ("warn" as const) : ("quiet" as const));

  // Part N — defect heatmap: quantity by process area × defect code, so the
  // WHERE and the WHAT are visible in one glance (the Pareto only shows what).
  const areas = [...new Set(ncs.map(n => n.processArea))].sort();
  const heatCodes = sorted.slice(0, 8).map(([c]) => c); // top codes by qty
  const heat = new Map<string, number>();
  for (const n of ncs) {
    if (!heatCodes.includes(n.defectCode)) continue;
    const k = `${n.processArea}|${n.defectCode}`;
    heat.set(k, (heat.get(k) ?? 0) + n.qty);
  }
  const heatMax = Math.max(1, ...heat.values());

  return (
    <div>
      <PageHeader eyebrow="Monitor & track" title={`${T.defects} & Pareto`}
        action={
          /* Part B2 — full log (not just the 50 displayed), same visible columns */
          <DownloadCsvButton
            filename="defect-log.csv"
            headers={["date", "code", "area", "qty", "severity", "description"]}
            rows={ncs.map(n => [new Date(n.date).toISOString().slice(0, 10), n.defectCode, n.processArea, n.qty, n.severity, n.description])}
          />
        } />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title={`Pareto of ${T.defects.toLowerCase()} (by quantity)`}>
            {pareto.length ? (
              <>
                <ParetoChart data={pareto} />
                <p className="text-xs text-steel mt-2">Bars stay sorted automatically as you log; the cumulative line is computed on the sorted order.</p>
              </>
            ) : <p className="text-sm text-steel">Log your first {T.defect.toLowerCase()} to build the Pareto.</p>}
          </Card>
          {areas.length > 1 && heatCodes.length > 1 && (
            <Card title={`Heatmap — where ${T.defects.toLowerCase()} occur (qty by area × code)`}>
              <div className="overflow-x-auto">
                <table className="data">
                  <thead><tr><th>Area</th>{heatCodes.map(c => <th key={c} className="mono">{c}</th>)}</tr></thead>
                  <tbody>
                    {areas.map(a => (
                      <tr key={a}>
                        <td className="font-medium">{a}</td>
                        {heatCodes.map(c => {
                          const v = heat.get(`${a}|${c}`) ?? 0;
                          const alpha = v ? 0.12 + 0.55 * (v / heatMax) : 0;
                          return (
                            <td key={c} className="mono text-center"
                              style={v ? { background: `rgba(179, 38, 30, ${alpha.toFixed(2)})`, color: alpha > 0.42 ? "#fff" : undefined, fontWeight: 600 } : undefined}>
                              {v || "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-steel mt-2">Darker = more quantity. A dark cell is a specific problem in a specific place — usually the fastest possible starting point for containment. Top {heatCodes.length} codes shown.</p>
            </Card>
          )}
          <Card title="Log">
            <table className="data">
              <thead><tr><th>Date</th><th>Code</th><th>Area</th><th>Qty</th><th>Severity</th><th>Notes</th></tr></thead>
              <tbody>
                {ncs.slice(0, 50).map(n => (
                  <tr key={n.id}>
                    <td className="mono">{new Date(n.date).toLocaleDateString()}</td>
                    <td className="font-semibold">{n.defectCode}</td>
                    <td>{n.processArea}</td>
                    <td className="mono">{n.qty}</td>
                    <td><Badge tone={sevTone(n.severity)}>{n.severity}</Badge></td>
                    <td className="text-steel">{n.description}</td>
                  </tr>
                ))}
                {!ncs.length && <tr><td colSpan={6} className="text-steel">Nothing logged yet.</td></tr>}
              </tbody>
            </table>
            {ncs.length > 50 && (
              <p className="text-xs text-steel mt-2">
                Showing the 50 most recent of {ncs.length} entries — the Pareto above and the CSV download include all of them.
              </p>
            )}
          </Card>
        </div>
        <Card title={`Log a ${T.defect.toLowerCase()}`}>
          <ActionForm action={addNc} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">{T.defect} code</label>
              <input className="input" name="defectCode" required placeholder="e.g. SCRATCH, LEAK-01" />
              <p className="text-xs text-steel mt-1">Keep codes consistent — recurrence detection matches on exact code + area.</p></div>
            <div><label className="label">Process area</label>
              <input className="input" name="processArea" required placeholder={`e.g. ${T.line} 4`} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Quantity</label><input className="input mono" name="qty" type="number" min={1} defaultValue={1} /></div>
              <div><label className="label">Severity</label>
                <select className="input" name="severity" defaultValue="minor">
                  <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
                </select></div>
            </div>
            <div><label className="label">Description (optional)</label><input className="input" name="description" /></div>
            <Submit>Log it</Submit>
            <p className="text-xs text-steel">
              Automation: the same code + area {d.ncRepeatThreshold}× within {d.ncRepeatWindowDays} days auto-drafts a CAPA for your review.
            </p>
          </ActionForm>
          {/* Part B3 — bulk import; each row goes through the same addNc logic,
              so recurrence detection and auto-CAPA drafting fire as usual */}
          <div className="border-t border-line pt-3 mt-4">
            <ImportNcCsv projectId={project.id} />
          </div>
        </Card>
      </div>
    </div>
  );
}
