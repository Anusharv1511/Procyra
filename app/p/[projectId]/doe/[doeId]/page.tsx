import { Card, PageHeader, Stat } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveDoeResponses } from "@/app/actions2";
import ParetoChart from "@/components/charts/ParetoChart";
import { getProject } from "@/lib/data";
import { doeEffects, doeSummary } from "@/lib/doe";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DoeDetail({ params }: { params: { projectId: string; doeId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [study] = await db.select().from(t.doeStudies).where(eq(t.doeStudies.id, params.doeId));
  if (!study || study.projectId !== project.id) notFound();
  const factors = study.factors as { name: string; low: string; high: string }[];
  const runs = study.runs as { levels: number[]; response: number | null }[];
  const res = doeEffects(factors, runs, study.designType as "full" | "half");

  // Pareto of |effects|, cumulative % over the sorted magnitudes.
  const sorted = [...res.effects].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  const totalMag = sorted.reduce((a, e) => a + Math.abs(e.effect), 0);
  let cum = 0;
  const pareto = sorted.map(e => {
    cum += Math.abs(e.effect);
    return { category: e.label, count: Number(Math.abs(e.effect).toFixed(4)), cumPct: totalMag ? (100 * cum) / totalMag : 0 };
  });

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze · DOE" title={study.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Design" value={`2^${factors.length}${study.designType === "half" ? "⁻¹" : ""}`} />
        <Stat label="Runs" value={String(runs.length)} />
        <Stat label="Entered" value={`${runs.filter(r => r.response != null).length}/${runs.length}`} />
        <Stat label="Grand mean" value={res.complete ? res.grandMean.toFixed(3) : "—"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title={`Run plan — enter ${study.responseName} per run`}>
            <ActionForm action={saveDoeResponses} className="space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="id" value={study.id} />
              <div className="overflow-x-auto">
                <table className="data">
                  <thead>
                    <tr><th>Run</th>{factors.map(f => <th key={f.name}>{f.name}</th>)}<th>{study.responseName}</th></tr>
                  </thead>
                  <tbody>
                    {runs.map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{i + 1}</td>
                        {r.levels.map((lv, j) => (
                          <td key={j} className="mono text-xs">{lv > 0 ? `+ ${factors[j]?.high}` : `− ${factors[j]?.low}`}</td>
                        ))}
                        <td className="!p-1">
                          <input className="input mono !py-1 !px-2 w-28" type="number" step="any"
                            name={`response_${i}`} defaultValue={r.response ?? ""}
                            data-kbd={i === 0 ? "new" : undefined} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Submit>Save responses</Submit>
            </ActionForm>
            <p className="text-xs text-steel mt-2">Run the experiment in RANDOM order (not table order) to protect against drift, but record each result on its matching row.</p>
          </Card>
          {res.complete && (
            <Card title="Pareto of effects (absolute magnitude)">
              <ParetoChart data={pareto} />
              <p className="text-xs text-steel mt-2">Effect = average response at the factor&apos;s high level minus at its low level{study.designType === "full" ? "; two-way interactions use the product of levels" : ""}. {study.designType === "half" && "In the half fraction, two-way interactions are aliased in pairs and therefore not reported individually."}</p>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          {res.complete ? (
            <>
              <Card title="What matters most">
                <p className="text-sm">{doeSummary(factors, res.effects)}</p>
              </Card>
              <Card title="All effects">
                <table className="data">
                  <thead><tr><th>Effect</th><th>Value</th></tr></thead>
                  <tbody>
                    {sorted.map(e => (
                      <tr key={e.label}>
                        <td className={e.kind === "interaction" ? "text-steel" : "font-medium"}>{e.label}</td>
                        <td className="mono">{e.effect >= 0 ? "+" : ""}{e.effect.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          ) : (
            <Card title="Effects">
              <p className="text-sm text-steel">Enter a response for every run — effects, the Pareto and the plain-language summary appear as soon as the design is complete.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
