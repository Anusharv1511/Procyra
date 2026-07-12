// Part A2 — public, read-only view of a shared project. No login required.
//
// Security posture:
//  - lookup is by exact share_token equality only; a missing/revoked/garbage
//    token → notFound() (plain 404, no distinction between "never existed"
//    and "revoked", so tokens can't be probed for information);
//  - tokens are 192-bit random values, unique-indexed, never listed anywhere;
//  - the page renders no forms, no server actions, no mutation affordances —
//    every module is presented view-only.

import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import ControlChart from "@/components/charts/ControlChart";
import Histogram from "@/components/charts/Histogram";
import OeeTrend from "@/components/charts/OeeTrend";
import { PLAYBOOKS } from "@/lib/playbooks";
import { db, t } from "@/db";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { xbarRLimits, imrLimits, capability, oee, mean, range } from "@/lib/spc";

export const dynamic = "force-dynamic";

export default async function SharedProject({ params }: { params: { token: string } }) {
  const token = params.token;
  // Guard against empty/absurd tokens before touching the database; real
  // tokens are 32 chars of base64url. Anything else can't match a project.
  if (!token || token.length < 16 || token.length > 128) notFound();

  const rows = await db
    .select({ p: t.projects, ws: t.workspaces })
    .from(t.projects)
    .innerJoin(t.workspaces, eq(t.workspaces.id, t.projects.workspaceId))
    .where(eq(t.projects.shareToken, token));
  if (!rows.length) notFound();
  const project = { ...rows[0].p, workspace: rows[0].ws };

  const [alerts, streams, capas, fmeas, playbookRuns] = await Promise.all([
    db.select().from(t.alerts)
      .where(eq(t.alerts.projectId, project.id))
      .orderBy(desc(t.alerts.createdAt)).limit(50),
    db.select().from(t.streams).where(eq(t.streams.projectId, project.id)),
    db.select().from(t.capas).where(eq(t.capas.projectId, project.id)).orderBy(desc(t.capas.updatedAt)),
    db.select().from(t.fmeas).where(eq(t.fmeas.projectId, project.id)),
    db.select().from(t.playbookRuns).where(eq(t.playbookRuns.projectId, project.id)).orderBy(desc(t.playbookRuns.createdAt)),
  ]);
  const openAlerts = alerts.filter(a => a.status === "open");
  const spcStreams = streams.filter(s => s.type.startsWith("SPC"));
  const oeeStreams = streams.filter(s => s.type === "OEE");
  const streamIds = streams.map(s => s.id);
  const pts = streamIds.length
    ? await db.select().from(t.dataPoints)
        .where(inArray(t.dataPoints.streamId, streamIds))
        .orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt))
    : [];
  const fmeaIds = fmeas.map(f => f.id);
  const fmeaItems = fmeaIds.length
    ? await db.select().from(t.fmeaItems).where(inArray(t.fmeaItems.fmeaId, fmeaIds))
    : [];

  const sevTone = (sev: string) =>
    sev === "critical" ? ("alarm" as const) : sev === "warning" ? ("warn" as const) : ("quiet" as const);
  const capaTone = (s: string) =>
    s === "draft" ? ("warn" as const) : s === "closed" || s === "verified" ? ("ok" as const) : ("accent" as const);

  return (
    <main className="min-h-screen">
      {/* read-only banner */}
      <div className="bg-[#22262b] text-white text-sm">
        <div className="mx-auto max-w-6xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <span>
            <span className="font-semibold">Viewing a shared, read-only project</span>
            <span className="text-gray-300"> — nothing here can be edited.</span>
          </span>
          <Link href="/register" className="underline hover:no-underline font-semibold">
            Sign up to build your own →
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-bold tracking-tight">Procyra</span>
          <span className="eyebrow">{project.workspace.name} · {project.workspace.industry.replace("_", " ")}</span>
        </div>
        <PageHeader eyebrow="Shared project (read-only)" title={project.name} />
        {project.description && <p className="text-sm text-steel -mt-3 mb-6 max-w-3xl">{project.description}</p>}

        {/* ---- Alert inbox (read-only, no Resolve buttons) ---- */}
        <Card title={`Alert inbox — ${openAlerts.length} open`} className="mb-6">
          {openAlerts.length === 0 ? (
            <p className="text-sm text-steel">No open alerts.</p>
          ) : (
            <ul className="space-y-2">
              {openAlerts.map(a => (
                <li key={a.id} className="card px-4 py-3 border-l-4"
                  style={{ borderLeftColor: a.severity === "critical" ? "var(--alarm)" : "var(--warn)" }}>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Badge tone={sevTone(a.severity)}>{a.ruleCode}</Badge>
                    <Badge tone="quiet">{a.sourceType}</Badge>
                  </div>
                  <p className="text-sm mt-1">{a.message}</p>
                  <p className="text-xs text-steel mt-0.5 mono">{new Date(a.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---- SPC streams: control chart + capability per stream ---- */}
        {spcStreams.map(stream => {
          const sp = pts.filter(p => p.streamId === stream.id);
          const isXbar = stream.type === "SPC_XBAR_R";
          const valuesPer = sp.map(p => ((p.payload as any).values as number[]) ?? []);
          const means = valuesPer.map(v => (isXbar ? mean(v) : v[0]));
          const ranges = isXbar ? valuesPer.map(v => range(v)) : [];
          const enough = sp.length >= 2;
          const lim = enough
            ? (isXbar ? xbarRLimits(means, ranges, stream.subgroupSize) : imrLimits(means))
            : null;
          const sigmaPlot = lim ? (isXbar ? lim.sigmaWithin / Math.sqrt(stream.subgroupSize) : lim.sigmaWithin) : 0;
          const chartData = sp.map((p, i) => ({
            label: new Date(p.ts).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) + ` #${i + 1}`,
            value: means[i],
            flags: (((p.computed as any)?.flags ?? []) as { rule: string }[]).map(f => f.rule),
          }));

          // capability — same lib functions and same 10-point minimum as the app
          const all = valuesPer.flat();
          const hasSpecs = stream.specLow != null || stream.specHigh != null;
          let capBlock: React.ReactNode = null;
          if (hasSpecs && all.length >= 10 && lim) {
            const cap = capability(all, lim.sigmaWithin, stream.specLow, stream.specHigh);
            const lo = Math.min(...all, stream.specLow ?? Infinity);
            const hi = Math.max(...all, stream.specHigh ?? -Infinity);
            const nb = Math.min(18, Math.max(7, Math.ceil(Math.sqrt(all.length))));
            const w = (hi - lo) / nb || 1;
            const bins = Array.from({ length: nb }, (_, i) => {
              const x0 = lo + i * w;
              return { x0, bin: (x0 + w / 2).toFixed(2), count: 0 };
            });
            for (const v of all) {
              const bi = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / w)));
              bins[bi].count++;
            }
            const nearest = (v: number | null) => v == null ? null
              : bins.reduce((best, b) => Math.abs(b.x0 + w / 2 - v) < Math.abs(best.x0 + w / 2 - v) ? b : best, bins[0]).bin;
            const fmt = (x: number | null) => (x == null ? "—" : x.toFixed(2));
            const tone = (x: number | null) => x == null ? undefined : x >= stream.cpkThreshold ? "ok" as const : x >= 1 ? "warn" as const : "alarm" as const;
            capBlock = (
              <Card title={`Capability — ${stream.name}`} className="mb-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <Stat label="Cp (within)" value={fmt(cap.cp)} tone={tone(cap.cp)} />
                  <Stat label="Cpk (within)" value={fmt(cap.cpk)} tone={tone(cap.cpk)} />
                  <Stat label="Pp (overall)" value={fmt(cap.pp)} tone={tone(cap.pp)} />
                  <Stat label="Ppk (overall)" value={fmt(cap.ppk)} tone={tone(cap.ppk)} />
                </div>
                <Histogram bins={bins.map(({ bin, count }) => ({ bin, count }))}
                  lslBin={nearest(stream.specLow)} uslBin={nearest(stream.specHigh)} />
                <p className="text-xs text-steel mt-2">
                  n = {cap.n} · mean {cap.mean.toFixed(3)} · σ within {cap.sigmaWithin.toFixed(4)} · σ overall {cap.sigmaOverall.toFixed(4)}.
                  Alert threshold: Cpk below {stream.cpkThreshold}.
                </p>
              </Card>
            );
          }

          return (
            <div key={stream.id}>
              <Card title={`SPC · ${stream.name} — ${isXbar ? `X̄-R (n=${stream.subgroupSize})` : "I-MR"}${stream.unit ? ` · ${stream.unit}` : ""}`} className="mb-6">
                {enough && lim ? (
                  <>
                    <ControlChart data={chartData} center={lim.center} ucl={lim.ucl} lcl={lim.lcl}
                      sigma={sigmaPlot} unit={stream.unit} />
                    <p className="text-xs text-steel mt-2">
                      {sp.length} entries · red points violated a Western Electric rule at entry time.
                      Spec limits: {stream.specLow ?? "—"} / {stream.specHigh ?? "—"}.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-steel">Not enough data logged to draw this chart.</p>
                )}
              </Card>
              {capBlock}
            </div>
          );
        })}

        {/* ---- OEE ---- */}
        {oeeStreams.map(stream => {
          const sp = pts.filter(p => p.streamId === stream.id);
          const target = stream.target ?? 0.85;
          const rows2 = sp.map(p => ({
            label: new Date(p.ts).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
            ...oee(p.payload as any),
          }));
          const latest = rows2[rows2.length - 1];
          return (
            <Card key={stream.id} title={`OEE · ${stream.name} — target ${(target * 100).toFixed(0)}%`} className="mb-6">
              {rows2.length ? (
                <>
                  <OeeTrend data={rows2} target={target} />
                  {latest && (
                    <p className="text-xs text-steel mt-2 mono">
                      Latest: OEE {(latest.oee * 100).toFixed(1)}% · A {(latest.availability * 100).toFixed(1)}% ·
                      P {(latest.performance * 100).toFixed(1)}% · Q {(latest.quality * 100).toFixed(1)}%
                    </p>
                  )}
                </>
              ) : <p className="text-sm text-steel">No entries logged.</p>}
            </Card>
          );
        })}

        {/* ---- FMEA register ---- */}
        {fmeas.map(f => {
          const items = fmeaItems.filter(i => i.fmeaId === f.id).sort((a, b) => b.rpn - a.rpn);
          return (
            <Card key={f.id} title={`FMEA · ${f.name} (${f.type}) — action threshold ${f.rpnAction}`} className="mb-6">
              <div className="overflow-x-auto">
                <table className="data">
                  <thead><tr><th>Step</th><th>Failure mode</th><th>Effect / cause</th><th>S</th><th>O</th><th>D</th><th>RPN</th><th>Action</th></tr></thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.id} className={it.rpn >= f.rpnAction ? "bg-red-50" : ""}>
                        <td>{it.processStep}</td>
                        <td className="font-semibold">{it.failureMode}
                          {it.linkedDefectCode && <div><Badge tone="quiet">↔ {it.linkedDefectCode}</Badge></div>}</td>
                        <td className="text-steel text-xs">{[it.effect, it.cause].filter(Boolean).join(" / ")}</td>
                        <td className="mono">{it.severity}</td>
                        <td className="mono">{it.occurrence}</td>
                        <td className="mono">{it.detection}</td>
                        <td className={`mono font-bold ${it.rpn >= f.rpnAction ? "text-alarm" : ""}`}>{it.rpn}</td>
                        <td className="text-xs">{it.recommendedAction ?? "—"}</td>
                      </tr>
                    ))}
                    {!items.length && <tr><td colSpan={8} className="text-steel">No failure modes recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}

        {/* ---- CAPA register ---- */}
        <Card title="CAPA register" className="mb-6">
          {capas.length === 0 ? (
            <p className="text-sm text-steel">No CAPAs on this project.</p>
          ) : (
            <ul className="space-y-2">
              {capas.map(c => (
                <li key={c.id} className="card px-4 py-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-semibold text-sm">{c.title}</span>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge tone={capaTone(c.status)}>{c.status.replace("_", " ")}</Badge>
                        {c.source === "auto" && <Badge tone="warn">auto-drafted by the app</Badge>}
                        {c.linkedDefectCode && <Badge tone="quiet">↔ {c.linkedDefectCode}</Badge>}
                      </div>
                      {(c.rootCause || c.correctiveAction) && (
                        <dl className="text-xs text-steel mt-2 space-y-0.5">
                          {c.rootCause && <div><span className="font-semibold">Root cause:</span> {c.rootCause}</div>}
                          {c.correctiveAction && <div><span className="font-semibold">Corrective:</span> {c.correctiveAction}</div>}
                          {c.preventiveAction && <div><span className="font-semibold">Preventive:</span> {c.preventiveAction}</div>}
                        </dl>
                      )}
                    </div>
                    <span className="text-xs text-steel mono">{new Date(c.updatedAt).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---- Playbook run summaries ---- */}
        {playbookRuns.map(run => {
          const pb = PLAYBOOKS[run.playbookKey];
          if (!pb) return null;
          const state = (run.state ?? {}) as Record<string, any>;
          return (
            <Card key={run.id} title={`Playbook · ${pb.title} — ${run.status}`} className="mb-6">
              <ol className="flex flex-wrap gap-2 mb-4">
                {pb.steps.map((s2, i) => {
                  const passed = run.status === "completed" || i < run.stepIndex;
                  const current = run.status !== "completed" && i === run.stepIndex;
                  return (
                    <li key={s2.key} className={`px-3 py-1.5 rounded-full text-xs font-semibold border
                      ${current ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : passed ? "bg-green-50 text-ok border-green-200" : "bg-white text-steel border-line"}`}>
                      {i + 1}. {s2.phase}
                    </li>
                  );
                })}
              </ol>
              <ul className="text-sm space-y-2">
                {pb.steps.filter(s2 => state[s2.key]).map(s2 => (
                  <li key={s2.key} className="card px-3 py-2">
                    <span className="font-semibold">{s2.phase} — {s2.title}</span>
                    <dl className="mt-1 text-xs text-steel">
                      {Object.entries(state[s2.key] ?? {}).map(([k, v]) => (
                        <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}

        <p className="text-xs text-steel mt-8 mb-4">
          Shared via Procyra — read-only view. <Link href="/register" className="text-accent font-semibold hover:underline">Create your own account</Link> to
          log data, run playbooks and get automatic alerts.
        </p>
      </div>
    </main>
  );
}
