import { Card, PageHeader, Badge } from "@/components/ui";
import GuidedStep from "@/components/GuidedStep";
import { PLAYBOOKS } from "@/lib/playbooks";
import { GUIDED_INTAKE, TOOL_META } from "@/lib/guided";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlaybookRun({ params }: { params: { projectId: string; runId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [run] = await db.select().from(t.playbookRuns).where(eq(t.playbookRuns.id, params.runId));
  if (!run || run.projectId !== project.id) notFound();
  const pb = PLAYBOOKS[run.playbookKey];
  if (!pb) notFound();
  const step = pb.steps[run.stepIndex];
  const state = (run.state ?? {}) as Record<string, any>;
  const done = run.status === "completed";

  // Fix 7 — read-only summary of real data that already exists on this project,
  // shown while a run is active so the step acknowledges work done elsewhere.
  // Pulled from existing tables only; nothing about the step's inputs changes.
  const [streams, capas, fmeas, ncCount] = done ? [[], [], [], 0] as any : await Promise.all([
    db.select().from(t.streams).where(eq(t.streams.projectId, project.id)),
    db.select().from(t.capas).where(eq(t.capas.projectId, project.id)),
    db.select().from(t.fmeas).where(eq(t.fmeas.projectId, project.id)),
    db.select({ n: sql<number>`count(*)` }).from(t.nonConformances)
      .where(eq(t.nonConformances.projectId, project.id)).then(r => Number(r[0]?.n ?? 0)),
  ]);
  const streamIds = (streams as any[]).map((s: any) => s.id);
  const countsByStream: Record<string, number> = {};
  if (streamIds.length) {
    const rows = await db.select({ streamId: t.dataPoints.streamId, n: sql<number>`count(*)` })
      .from(t.dataPoints).where(inArray(t.dataPoints.streamId, streamIds))
      .groupBy(t.dataPoints.streamId);
    for (const r of rows) countsByStream[r.streamId] = Number(r.n);
  }
  const spcStreams = (streams as any[]).filter((s: any) => s.type.startsWith("SPC"));
  const oeeStreams = (streams as any[]).filter((s: any) => s.type === "OEE");
  const openCapas = (capas as any[]).filter((c: any) => c.status !== "closed" && c.status !== "verified");
  const hasExisting = spcStreams.length || oeeStreams.length || openCapas.length || (fmeas as any[]).length || ncCount > 0;

  // Part P — step state now also carries structured fields (intake answers,
  // ranked recommendations, chosen tool, pulled tool result). Render each
  // shape readably instead of String(v).
  const renderStateEntry = (stepKey: string, k: string, v: any) => {
    if (k === "intake" && v && typeof v === "object") {
      const qs = GUIDED_INTAKE[run.playbookKey]?.[stepKey] ?? [];
      return Object.entries(v as Record<string, string>).map(([qk, ans]) => {
        const q = qs.find(x => x.key === qk);
        const opt = q?.options.find(o => o.value === ans);
        return <div key={qk}><span className="font-semibold">{q?.question ?? qk}:</span> {opt?.label ?? String(ans)}</div>;
      });
    }
    if (k === "recommendations" && Array.isArray(v)) {
      return <div><span className="font-semibold">shortlist suggested:</span> {v.map((r: any, i: number) => `#${i + 1} ${r.label} (fit ${r.score})`).join(", ")}</div>;
    }
    if (k === "recommendedTool") return null; // covered by the shortlist line
    if (k === "chosenTool") {
      return <div><span className="font-semibold">tool chosen by team:</span> {v ? (TOOL_META as any)[v]?.label ?? String(v) : "none (skipped)"}</div>;
    }
    if (k === "toolResult" && v && typeof v === "object") {
      return <div><span className="font-semibold">live result pulled:</span> {(v as any).summary}{(v as any).detail ? ` ${(v as any).detail}` : ""}</div>;
    }
    return <div><span className="font-semibold">{k}:</span> {String(v)}</div>;
  };

  return (
    <div>
      <PageHeader eyebrow={`Guided mode · ${pb.title}`} title={done ? "Completed" : step.title} />

      {/* DMAIC progress */}
      <ol className="flex flex-wrap gap-2 mb-6">
        {pb.steps.map((s, i) => {
          const current = !done && i === run.stepIndex;
          const passed = done || i < run.stepIndex;
          return (
            <li key={s.key} className={`px-3 py-1.5 rounded-full text-xs font-semibold border
              ${current ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : passed ? "bg-green-50 text-ok border-green-200" : "bg-white text-steel border-line"}`}>
              {i + 1}. {s.phase}
            </li>
          );
        })}
      </ol>

      {done ? (
        <Card title="Playbook complete">
          <p className="text-sm">Every step and decision from this run is recorded.</p>
          <ul className="text-sm mt-3 space-y-2">
            {pb.steps.map(s => (
              <li key={s.key} className="card px-3 py-2">
                <span className="font-semibold">{s.phase} — {s.title}</span>
                <dl className="mt-1 text-xs text-steel">
                  {Object.entries(state[s.key] ?? {}).map(([k, v]) => (
                    <div key={k}>{renderStateEntry(s.key, k, v)}</div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <Link className="btn btn-quiet" href={`/p/${project.id}/decisions`}>View decision log</Link>
            <Link className="btn btn-quiet" href={`/p/${project.id}/playbooks`}>Back to playbooks</Link>
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card title="Why this step">
              <p className="text-sm">{step.why}</p>
              {step.howToCollect && (
                <div className="mt-3 rounded-lg bg-paper border border-line p-3">
                  <div className="eyebrow mb-1">How to collect the data</div>
                  <p className="text-sm">{step.howToCollect}</p>
                </div>
              )}
              {step.moduleHint && (
                <Link className="btn mt-4" href={step.moduleHint.href(project.id)} target="_blank">
                  {step.moduleHint.label} ↗
                </Link>
              )}
            </Card>
            {/* Part P — one question at a time; at Measure/Analyze the intake
                answers produce a ranked tool shortlist and the chosen tool's
                real output is pulled back in on submit. */}
            <Card title={step.gate ? "Guided intake + the team's decision" : "Guided intake"}>
              <GuidedStep
                projectId={project.id}
                runId={run.id}
                step={{ ...step, moduleHint: undefined }}
                stepKey={step.key}
                intake={GUIDED_INTAKE[run.playbookKey]?.[step.key] ?? []}
                isLast={run.stepIndex + 1 === pb.steps.length}
              />
            </Card>
          </div>
          <div className="space-y-4">
            {hasExisting ? (
              <Card title="You already have (on this project)">
                <p className="text-xs text-steel mb-2">Real data logged elsewhere in the app — worth checking before re-collecting anything. Informational only.</p>
                <ul className="text-sm space-y-1.5">
                  {spcStreams.map((s: any) => (
                    <li key={s.id}>
                      <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/spc/${s.id}`}>SPC: {s.name}</Link>
                      <span className="text-steel"> — {countsByStream[s.id] ?? 0} entr{(countsByStream[s.id] ?? 0) === 1 ? "y" : "ies"}</span>
                    </li>
                  ))}
                  {oeeStreams.map((s: any) => (
                    <li key={s.id}>
                      <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/oee/${s.id}`}>OEE: {s.name}</Link>
                      <span className="text-steel"> — {countsByStream[s.id] ?? 0} entr{(countsByStream[s.id] ?? 0) === 1 ? "y" : "ies"}</span>
                    </li>
                  ))}
                  {openCapas.map((c: any) => (
                    <li key={c.id}>
                      <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/capa`}>CAPA: {c.title}</Link>
                      <span className="text-steel"> — {String(c.status).replace("_", " ")}</span>
                    </li>
                  ))}
                  {(fmeas as any[]).map((f: any) => (
                    <li key={f.id}>
                      <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/fmea/${f.id}`}>FMEA: {f.name}</Link>
                    </li>
                  ))}
                  {ncCount > 0 && (
                    <li>
                      <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/nc`}>Defect log</Link>
                      <span className="text-steel"> — {ncCount} entr{ncCount === 1 ? "y" : "ies"}</span>
                    </li>
                  )}
                </ul>
              </Card>
            ) : null}
            <Card title="Progress so far">
              {Object.keys(state).length === 0
                ? <p className="text-sm text-steel">Nothing captured yet.</p>
                : (
                  <ul className="text-xs space-y-2">
                    {pb.steps.filter(s => state[s.key]).map(s => (
                      <li key={s.key}>
                        <Badge tone="ok">{s.phase}</Badge>
                        <dl className="mt-1 text-steel">
                          {Object.entries(state[s.key]).map(([k, v]) => (
                            <div key={k}>{renderStateEntry(s.key, k, v)}</div>
                          ))}
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
