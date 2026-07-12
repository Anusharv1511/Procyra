import { Card, PageHeader, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addSpcPoint } from "@/app/actions";
import ControlChart from "@/components/charts/ControlChart";
import AlertsBanner from "@/components/AlertsBanner";
import PrintButton from "@/components/PrintButton";
import DownloadCsvButton from "@/components/DownloadCsvButton";
import ImportSpcCsv from "@/components/ImportSpcCsv";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { xbarRLimits, imrLimits, mean, range } from "@/lib/spc";

export const dynamic = "force-dynamic";

export default async function SpcStream({ params }: { params: { projectId: string; streamId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [stream] = await db.select().from(t.streams).where(eq(t.streams.id, params.streamId));
  if (!stream || stream.projectId !== project.id) notFound();
  const pts = await db.select().from(t.dataPoints)
    .where(eq(t.dataPoints.streamId, stream.id))
    .orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt));

  const isXbar = stream.type === "SPC_XBAR_R";
  const valuesPer = pts.map(p => ((p.payload as any).values as number[]) ?? []);
  const means = valuesPer.map(v => (isXbar ? mean(v) : v[0]));
  const ranges = isXbar ? valuesPer.map(v => range(v)) : [];
  const enough = pts.length >= 2;
  const lim = enough
    ? (isXbar ? xbarRLimits(means, ranges, stream.subgroupSize) : imrLimits(means))
    : null;
  const sigmaPlot = lim ? (isXbar ? lim.sigmaWithin / Math.sqrt(stream.subgroupSize) : lim.sigmaWithin) : 0;

  // Fix 3 — out of spec (customer tolerance) is a different condition from out
  // of control (WE rule): a point is out of spec when any measurement in it
  // falls outside LSL/USL. Display only — no rule or alert logic touched.
  const hasSpecs = stream.specLow != null || stream.specHigh != null;
  const outOfSpec = valuesPer.map(vs => hasSpecs && vs.some(v =>
    (stream.specLow != null && v < stream.specLow) ||
    (stream.specHigh != null && v > stream.specHigh)));

  const chartData = pts.map((p, i) => ({
    label: new Date(p.ts).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) + ` #${i + 1}`,
    value: means[i],
    flags: (((p.computed as any)?.flags ?? []) as { rule: string }[]).map(f => f.rule),
    outOfSpec: outOfSpec[i],
  }));
  const flagged = pts
    .map((p, i) => ({
      p, i,
      flags: ((p.computed as any)?.flags ?? []) as { rule: string; message: string }[],
      oos: outOfSpec[i],
    }))
    .filter(x => x.flags.length > 0 || x.oos)
    .reverse();
  const anyOos = flagged.some(x => x.oos);

  return (
    <div>
      <PageHeader
        eyebrow={`SPC · ${isXbar ? `X̄-R, subgroup n=${stream.subgroupSize}` : "I-MR"}`}
        title={stream.name}
        action={
          <div className="flex gap-2 flex-wrap">
            {/* Part B2 — raw logged data points, same rows as the chart/table below */}
            <DownloadCsvButton
              filename={`spc-${stream.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`}
              headers={isXbar ? ["timestamp", "values", "mean", "range", "flags"] : ["timestamp", "value", "flags"]}
              rows={pts.map((p, i) => {
                const flags = (((p.computed as any)?.flags ?? []) as { rule: string }[]).map(f => f.rule).join(" ");
                return isXbar
                  ? [new Date(p.ts).toISOString(), valuesPer[i].join(" "), means[i], ranges[i], flags]
                  : [new Date(p.ts).toISOString(), means[i], flags];
              })}
            />
            <PrintButton />
            <Link className="btn btn-quiet no-print" href={`/p/${project.id}/capability?stream=${stream.id}`}>Capability report</Link>
          </div>
        }
      />
      <AlertsBanner projectId={project.id} streamId={stream.id} scopeLabel="this stream" />
      <div className="grid lg:grid-cols-3 gap-4 print-stack">
        <div className="lg:col-span-2 space-y-4">
          <Card title={isXbar ? "X̄ chart (subgroup means)" : "Individuals chart"}>
            {enough && lim ? (
              <>
                <ControlChart data={chartData} center={lim.center} ucl={lim.ucl} lcl={lim.lcl}
                  sigma={sigmaPlot} unit={stream.unit} />
                {hasSpecs && (
                  <p className="text-xs mt-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full align-middle mr-1" style={{ background: "var(--alarm)" }} />
                    <span className="text-steel mr-3">out of control — violates a control rule (Western Electric)</span>
                    <span className="inline-block h-2.5 w-2.5 align-middle mr-1" style={{ background: "var(--alarm)" }} />
                    <span className="text-steel">out of spec — outside customer tolerance (LSL/USL)</span>
                  </p>
                )}
                <p className="text-xs text-steel mt-2">
                  Limits recompute from all logged data. Zones show ±1σ/±2σ/±3σ. Red points violated a
                  Western Electric rule at entry time. With fewer than ~20 subgroups, treat limits as preliminary.
                </p>
              </>
            ) : (
              <p className="text-sm text-steel">Log at least two entries to draw the chart. Control limits become meaningful around 20 subgroups.</p>
            )}
          </Card>
          {flagged.length > 0 && (
            <Card title={anyOos ? "Out-of-control / out-of-spec history" : "Out-of-control history"}>
              <table className="data">
                <thead><tr><th>When</th><th>Value</th><th>Condition</th></tr></thead>
                <tbody>
                  {flagged.map(x => (
                    <tr key={x.p.id}>
                      <td className="mono">{new Date(x.p.ts).toLocaleString()}</td>
                      <td className="mono">{means[x.i].toFixed(3)}{stream.unit ? ` ${stream.unit}` : ""}</td>
                      <td>
                        <span className="flex flex-wrap gap-1 items-center">
                          {x.flags.map(f => <Badge key={f.rule} tone="alarm">{f.rule}</Badge>)}
                          {x.oos && (
                            <span className="inline-block border border-red-200 bg-red-50 text-alarm rounded px-2 py-0.5 text-[11px] font-semibold">
                              OUT OF SPEC
                            </span>
                          )}
                        </span>
                        <div className="text-xs text-steel mt-1">
                          {[
                            ...x.flags.map(f => f.message),
                            ...(x.oos ? ["Measurement outside spec limits (LSL/USL)"] : []),
                          ].join("; ")}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card title="Log a measurement" className="no-print">
            <ActionForm action={addSpcPoint} className="space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="streamId" value={stream.id} />
              <div>
                <label className="label">
                  {isXbar ? `${stream.subgroupSize} measurements (comma or space separated)` : "Measurement"}
                </label>
                <input className="input mono" name="values" required
                  placeholder={isXbar ? "10.01, 9.98, 10.02, 10.00, 9.99" : "10.01"} />
              </div>
              <Submit>Log entry</Submit>
              <p className="text-xs text-steel">Western Electric rules 1–4 run the moment you log. Violations flag the point and raise an alert — no manual re-check.</p>
            </ActionForm>
            {/* Part B3 — bulk import; each row goes through the same addSpcPoint logic */}
            <div className="border-t border-line pt-3 mt-4">
              <ImportSpcCsv projectId={project.id} streamId={stream.id}
                subgroupSize={isXbar ? stream.subgroupSize : 1} />
            </div>
          </Card>
          <Card title="Stream settings">
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-steel">Spec limits</dt><dd className="mono">{stream.specLow ?? "—"} / {stream.specHigh ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-steel">Cpk alert below</dt><dd className="mono">{stream.cpkThreshold}</dd></div>
              <div className="flex justify-between"><dt className="text-steel">Entries</dt><dd className="mono">{pts.length}</dd></div>
              {lim && <>
                <div className="flex justify-between"><dt className="text-steel">CL / UCL / LCL</dt><dd className="mono">{lim.center.toFixed(3)} / {lim.ucl.toFixed(3)} / {lim.lcl.toFixed(3)}</dd></div>
                <div className="flex justify-between"><dt className="text-steel">σ (within)</dt><dd className="mono">{lim.sigmaWithin.toFixed(4)}</dd></div>
              </>}
            </dl>
            <p className="text-xs text-steel mt-2">
              This alert tracks Cpk (short-term/within); Ppk (overall) is shown on the capability report for reference but does not trigger an alert.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
