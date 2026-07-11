import { Card, PageHeader, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { advancePlaybook } from "@/app/actions";
import { PLAYBOOKS } from "@/lib/playbooks";
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
                    <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
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
            <Card title={step.gate ? "Record what happened + the team's decision" : "Record what happened"}>
              <ActionForm action={advancePlaybook} className="space-y-4">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="runId" value={run.id} />
                {(step.inputs ?? []).map(inp => (
                  <div key={inp.key}>
                    <label className="label">{inp.label}</label>
                    {inp.textarea
                      ? <textarea className="input" name={inp.key} rows={3} placeholder={inp.placeholder} />
                      : <input className="input" name={inp.key} placeholder={inp.placeholder} />}
                  </div>
                ))}
                {step.gate && (
                  <fieldset className="space-y-2">
                    <legend className="label">{step.gate.question}</legend>
                    <p className="text-xs text-steel mb-1">The app suggests — your team decides. Pick what was actually agreed, not what the app likes.</p>
                    {step.gate.options.map(o => (
                      <label key={o.value} className="card flex gap-3 px-3 py-2 cursor-pointer items-start">
                        <input type="radio" name="gate_choice" value={o.label} className="mt-1" />
                        <span>
                          <span className="text-sm font-semibold">{o.label}</span>
                          <span className="block text-xs text-steel">{o.rationale}</span>
                        </span>
                      </label>
                    ))}
                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                      <div><label className="label">Why (team rationale)</label><input className="input" name="gate_rationale" /></div>
                      <div><label className="label">Decided by</label><input className="input" name="gate_decidedBy" placeholder="e.g. Line 4 kaizen team" /></div>
                    </div>
                  </fieldset>
                )}
                <Submit>{run.stepIndex + 1 === pb.steps.length ? "Finish playbook" : "Save & continue"}</Submit>
              </ActionForm>
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
                            <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
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
