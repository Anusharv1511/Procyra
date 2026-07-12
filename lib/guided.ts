// Part P — Conversational guided flow for the DMAIC playbook.
//
// This file OVERLAYS the existing lib/playbooks.ts definitions (which are
// untouched, per guardrail): for each playbook step it can define a short
// intake — one question at a time — and, for the Measure and Analyze steps,
// an explainable rule-based recommender that turns the intake answers into a
// RANKED SHORTLIST of at most 3 tools with a one-line "why this fits" per
// suggestion. The recommender is deliberately transparent: fixed rules add
// weighted points and a reason string; the score is just the sum. The app
// suggests — the team decides (the existing decision-gate logging in
// advanceGuidedStep records both, exactly like advancePlaybook does).
//
// Everything captured here is stored additively inside playbook_runs.state
// (jsonb) — no schema change: state[stepKey] = { intake, recommendations,
// chosenTool, toolResult, ...gate decision as before }.

export type IntakeQuestion = {
  key: string;
  question: string;
  help?: string;
  options: { value: string; label: string }[];
};

export type ToolKey = "spc" | "capability" | "gagerr" | "timestudy" | "doe";

export const TOOL_META: Record<ToolKey, { label: string; href: (projectId: string) => string }> = {
  spc: { label: "Control charts (SPC)", href: p => `/p/${p}/spc` },
  capability: { label: "Process capability", href: p => `/p/${p}/capability` },
  gagerr: { label: "Gage R&R / MSA", href: p => `/p/${p}/gagerr` },
  timestudy: { label: "Time study", href: p => `/p/${p}/timestudy` },
  doe: { label: "DOE (Design of Experiments)", href: p => `/p/${p}/doe` },
};

export type Recommendation = { tool: ToolKey; score: number; reasons: string[] };

// ---- Intake definitions, keyed by playbook key → step key -------------------

export const GUIDED_INTAKE: Record<string, Record<string, IntakeQuestion[]>> = {
  reduce_defects: {
    define: [
      { key: "scope", question: "Is the problem confined to one process/station, or spread across several?",
        options: [{ value: "one", label: "One process or station" }, { value: "several", label: "Several areas" }] },
      { key: "since", question: "Did this start after a known change (new tool, material, program, operator)?",
        help: "A clear 'since when' turns root-cause hunting from archaeology into a diff.",
        options: [{ value: "known_change", label: "Yes — after a known change" }, { value: "gradual", label: "No — gradual or always been there" }] },
    ],
    measure: [
      { key: "measurable", question: "Is the defect driven by a measurable characteristic (a dimension, weight, temperature, time)?",
        options: [{ value: "yes", label: "Yes — we can put a number on it" }, { value: "attribute", label: "No — it's pass/fail or cosmetic" }] },
      { key: "trust_measurement", question: "When two people measure the same part, do they get the same answer?",
        help: "If not, fix the measurement system before trusting any data collected with it.",
        options: [{ value: "yes", label: "Yes — measurements agree" }, { value: "no", label: "No / not sure — results vary by person" }] },
      { key: "labor_content", question: "Is timing or labor content part of the problem (cycle time, pace, method variation)?",
        options: [{ value: "yes", label: "Yes — method/time matters" }, { value: "no", label: "No — purely a quality issue" }] },
    ],
    analyze: [
      { key: "stability", question: "Looking at the data so far — is the process stable but off-target/too variable, or does it jump around unpredictably?",
        options: [
          { value: "unstable", label: "Unstable — sudden shifts, drifts, or outliers" },
          { value: "stable_incapable", label: "Stable, but too variable or off-center for the spec" },
          { value: "unknown", label: "Don't know yet" }] },
      { key: "factors", question: "Do you have specific, adjustable settings you suspect (speeds, feeds, temperatures, pressures)?",
        options: [
          { value: "few", label: "Yes — 2 to 4 candidate settings" },
          { value: "many_unknown", label: "Many possibilities / unclear" },
          { value: "none", label: "No adjustable settings involved" }] },
      { key: "data_doubt", question: "Has anyone questioned whether the measurements themselves can be trusted?",
        options: [{ value: "yes", label: "Yes — the numbers are disputed" }, { value: "no", label: "No — the data is accepted" }] },
    ],
  },
};

// ---- Explainable recommender -------------------------------------------------
// Fixed rules: each matching rule adds points and a plain-language reason.
// The shortlist = top-scoring tools (score > 0), max 3.

type Rule = { when: (a: Record<string, string>) => boolean; tool: ToolKey; points: number; reason: string };

const MEASURE_RULES: Rule[] = [
  { when: a => a.trust_measurement === "no", tool: "gagerr", points: 5,
    reason: "You said measurements vary by person — quantify measurement error first; baseline data collected with an untrusted gage proves nothing." },
  { when: a => a.measurable === "yes", tool: "spc", points: 4,
    reason: "The defect has a measurable driver — a control chart baselines both its level and its stability from day one." },
  { when: a => a.measurable === "yes" && a.trust_measurement === "yes", tool: "capability", points: 2,
    reason: "With trusted measurements and spec limits, capability tells you whether the process can hold the spec at all." },
  { when: a => a.labor_content === "yes", tool: "timestudy", points: 3,
    reason: "Timing/method is part of the problem — a rated time study baselines the labor content before you change the method." },
  { when: a => a.measurable === "attribute", tool: "spc", points: 1,
    reason: "Even for pass/fail defects, logging the defect rate over time in the defect log + a trend view beats a one-off count." },
];

const ANALYZE_RULES: Rule[] = [
  { when: a => a.data_doubt === "yes", tool: "gagerr", points: 5,
    reason: "The numbers themselves are disputed — settle the measurement-system question before arguing about causes." },
  { when: a => a.stability === "unstable", tool: "spc", points: 4,
    reason: "Unstable behavior means special causes — the control chart's rule violations point to when they strike; fix stability before optimizing settings." },
  { when: a => a.stability === "stable_incapable", tool: "capability", points: 4,
    reason: "A stable but incapable process is a common-cause problem — capability quantifies the gap between voice-of-process and voice-of-customer." },
  { when: a => a.stability === "stable_incapable" && a.factors === "few", tool: "doe", points: 4,
    reason: "You have 2–4 candidate settings and a stable process — a small factorial finds which setting (or interaction) actually moves the response." },
  { when: a => a.factors === "few" && a.stability !== "unstable", tool: "doe", points: 2,
    reason: "With a handful of adjustable settings, a designed experiment beats one-factor-at-a-time trial and error." },
  { when: a => a.stability === "unknown", tool: "spc", points: 3,
    reason: "Stability is unknown — the control chart answers that question first, and every other analysis depends on it." },
  { when: a => a.factors === "many_unknown", tool: "spc", points: 1,
    reason: "With many unknown causes, chart the process and use the timing of rule violations to narrow the field before experimenting." },
];

export function recommendTools(stepKey: string, answers: Record<string, string>): Recommendation[] {
  const rules = stepKey === "measure" ? MEASURE_RULES : stepKey === "analyze" ? ANALYZE_RULES : [];
  const acc: Record<string, Recommendation> = {};
  for (const r of rules) {
    if (!r.when(answers)) continue;
    acc[r.tool] ??= { tool: r.tool, score: 0, reasons: [] };
    acc[r.tool].score += r.points;
    acc[r.tool].reasons.push(r.reason);
  }
  return Object.values(acc).sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Steps whose intake ends in a ranked tool shortlist. */
export const SHORTLIST_STEPS = ["measure", "analyze"];
