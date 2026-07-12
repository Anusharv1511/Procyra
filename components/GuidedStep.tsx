"use client";

// Part P — the conversational guided step. Replaces the static step form with
// a short intake: ONE question at a time, advancing with "Next". At the
// Measure and Analyze steps the intake answers feed lib/guided's explainable
// rule engine and the user gets a RANKED SHORTLIST of at most 3 tools, each
// with a one-line "why this fits". The user opens the tool they choose (in a
// new tab), and on submit the server pulls that tool's REAL output into the
// step (advanceGuidedStep). Decision gates render last, exactly as before —
// the app suggests, the team decides, and both are logged.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ActionForm, Submit } from "@/components/forms";
import { advanceGuidedStep } from "@/app/actions2";
import { recommendTools, TOOL_META, SHORTLIST_STEPS, IntakeQuestion, ToolKey } from "@/lib/guided";
import type { PlaybookStep } from "@/lib/playbooks";

type Item =
  | { kind: "intake"; q: IntakeQuestion }
  | { kind: "input"; input: NonNullable<PlaybookStep["inputs"]>[number] }
  | { kind: "shortlist" }
  | { kind: "gate" };

export default function GuidedStep({ projectId, runId, step, stepKey, intake, isLast }: {
  projectId: string; runId: string; step: PlaybookStep; stepKey: string;
  intake: IntakeQuestion[]; isLast: boolean;
}) {
  const intakeQs = intake;
  const items: Item[] = useMemo(() => {
    const list: Item[] = [];
    for (const q of intakeQs) list.push({ kind: "intake", q });
    for (const input of step.inputs ?? []) list.push({ kind: "input", input });
    if (SHORTLIST_STEPS.includes(stepKey) && intakeQs.length) list.push({ kind: "shortlist" });
    if (step.gate) list.push({ kind: "gate" });
    return list;
  }, [step, stepKey, intakeQs]);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [chosenTool, setChosenTool] = useState<ToolKey | "">("");
  const cur = items[Math.min(idx, items.length - 1)];
  const atEnd = idx >= items.length - 1;
  const recs = useMemo(
    () => (SHORTLIST_STEPS.includes(stepKey) ? recommendTools(stepKey, answers) : []),
    [stepKey, answers]);

  const canAdvance =
    cur.kind === "intake" ? !!answers[cur.q.key]
    : cur.kind === "input" ? !!(inputs[cur.input.key] ?? "").trim()
    : true; // shortlist choice is optional (skip allowed); gate validated on submit

  return (
    <ActionForm action={advanceGuidedStep} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="runId" value={runId} />
      {/* Everything answered so far rides along as hidden fields */}
      {Object.entries(answers).map(([k, v]) => <input key={k} type="hidden" name={`intake_${k}`} value={v} />)}
      {Object.entries(inputs).map(([k, v]) => (items.some(it => it.kind === "input" && it.input.key === k) ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input type="hidden" name="chosen_tool" value={chosenTool} />

      {/* progress dots within the step */}
      <div className="flex gap-1.5" aria-hidden>
        {items.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all duration-200 ${i === idx ? "w-6 bg-[var(--accent)]" : i < idx ? "w-3 bg-ok" : "w-3 bg-[var(--line)]"}`} />
        ))}
      </div>

      {cur.kind === "intake" && (
        <fieldset key={cur.q.key} className="anim-pop">
          <legend className="font-semibold text-sm mb-1">{cur.q.question}</legend>
          {cur.q.help && <p className="text-xs text-steel mb-2">{cur.q.help}</p>}
          <div className="space-y-2 mt-2">
            {cur.q.options.map(o => (
              <label key={o.value} className={`card flex gap-3 px-3 py-2 cursor-pointer items-center border-2 ${answers[cur.q.key] === o.value ? "!border-[var(--accent)]" : "!border-transparent"}`}>
                <input type="radio" checked={answers[cur.q.key] === o.value}
                  onChange={() => setAnswers(a => ({ ...a, [cur.q.key]: o.value }))} />
                <span className="text-sm font-medium">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {cur.kind === "input" && (
        <div key={cur.input.key} className="anim-pop">
          <label className="label">{cur.input.label}</label>
          {cur.input.textarea
            ? <textarea className="input" rows={3} placeholder={cur.input.placeholder}
                value={inputs[cur.input.key] ?? ""} onChange={e => setInputs(s => ({ ...s, [cur.input.key]: e.target.value }))} />
            : <input className="input" placeholder={cur.input.placeholder}
                value={inputs[cur.input.key] ?? ""} onChange={e => setInputs(s => ({ ...s, [cur.input.key]: e.target.value }))} />}
        </div>
      )}

      {cur.kind === "shortlist" && (
        <div className="anim-pop">
          <p className="font-semibold text-sm">Best-fit tools for your situation</p>
          <p className="text-xs text-steel mb-2">Ranked from your answers by fixed, explainable rules — the app suggests, your team decides. Open the tool you pick; its real output will be pulled into this step when you continue.</p>
          {recs.length === 0 ? (
            <p className="text-sm text-steel">No specific tool stands out from your answers — continue, and use the Pareto/defect log as your baseline.</p>
          ) : (
            <div className="space-y-2">
              {recs.map((r, i) => (
                <label key={r.tool} className={`card flex gap-3 px-3 py-2.5 cursor-pointer items-start border-2 ${chosenTool === r.tool ? "!border-[var(--accent)]" : "!border-transparent"}`}>
                  <input type="radio" className="mt-1" checked={chosenTool === r.tool} onChange={() => setChosenTool(r.tool)} />
                  <span className="min-w-0">
                    <span className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                      #{i + 1} {TOOL_META[r.tool].label}
                      <span className="inline-block rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-steel">fit score {r.score}</span>
                      {i === 0 && <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-accent">recommended</span>}
                    </span>
                    <span className="block text-xs text-steel mt-0.5">{r.reasons[0]}</span>
                    {chosenTool === r.tool && (
                      <Link href={TOOL_META[r.tool].href(projectId)} target="_blank" className="btn btn-quiet !py-1 !px-2 text-xs mt-2">
                        Open {TOOL_META[r.tool].label} ↗
                      </Link>
                    )}
                  </span>
                </label>
              ))}
              <button type="button" className="text-xs text-steel underline" onClick={() => setChosenTool("")}>
                Skip — the team will proceed without one of these tools
              </button>
            </div>
          )}
        </div>
      )}

      {cur.kind === "gate" && step.gate && (
        <fieldset className="space-y-2 anim-pop">
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

      <div className="flex items-center gap-2">
        {idx > 0 && (
          <button type="button" className="btn btn-quiet" onClick={() => setIdx(i => Math.max(0, i - 1))}>← Back</button>
        )}
        {!atEnd ? (
          <button type="button" className="btn" disabled={!canAdvance} onClick={() => setIdx(i => i + 1)}>Next →</button>
        ) : (
          <Submit>{isLast ? "Finish playbook" : "Save & continue"}</Submit>
        )}
        <span className="text-xs text-steel ml-auto">{idx + 1} / {items.length}</span>
      </div>
    </ActionForm>
  );
}
