// Guided Mode — playbook definitions. A playbook is a DMAIC-shaped sequence of
// steps. Analysis steps end at a decision gate: the app suggests options with
// rationale, the user records the team's actual decision, and only then does
// the playbook advance. The app recommends; people decide.

export type PlaybookStep = {
  key: string;
  phase: "Define" | "Measure" | "Analyze" | "Improve" | "Control";
  title: string;
  why: string;            // why this step exists (novice guidance)
  howToCollect?: string;  // concrete data-collection instructions
  moduleHint?: { label: string; href: (projectId: string) => string };
  inputs?: { key: string; label: string; placeholder?: string; textarea?: boolean }[];
  gate?: {
    key: string;
    question: string;
    // options the app suggests, each with plain-language rationale
    options: { value: string; label: string; rationale: string }[];
  };
};

export type Playbook = { key: string; title: string; goal: string; steps: PlaybookStep[] };

export const PLAYBOOKS: Record<string, Playbook> = {
  reduce_defects: {
    key: "reduce_defects",
    title: "Reduce defects in a process",
    goal: "Take a process from 'we have quality problems' to a monitored, controlled state — the full DMAIC loop.",
    steps: [
      {
        key: "define",
        phase: "Define",
        title: "Define the problem and the metric",
        why: "Improvement efforts fail most often because the problem was never pinned down. One process, one measurable defect definition, one baseline number.",
        inputs: [
          { key: "process", label: "Process or area under study", placeholder: "e.g. Final assembly, station 4" },
          { key: "problem", label: "Problem statement (what, where, how much, since when)", textarea: true },
          { key: "metric", label: "Primary metric", placeholder: "e.g. defects per 100 units, first pass yield %" },
        ],
      },
      {
        key: "measure",
        phase: "Measure",
        title: "Collect baseline data",
        why: "You cannot tell whether you improved anything without a baseline measured the same way you will measure afterwards.",
        howToCollect:
          "Log every defect as it occurs — not from memory at end of shift. Use one defect code per failure type and keep codes consistent (pick from a list, don't free-type). If a measurable characteristic drives the defect, set up an SPC stream and log at least 20 subgroups before drawing conclusions.",
        moduleHint: { label: "Open defect log", href: (p) => `/p/${p}/nc` },
        inputs: [
          { key: "baseline_days", label: "How many days of baseline data did you collect?", placeholder: "e.g. 10" },
        ],
      },
      {
        key: "analyze",
        phase: "Analyze",
        title: "Find the vital few causes",
        why: "A handful of defect types almost always account for most of the pain (the Pareto principle). Attack the biggest bar first, and check whether the process is even capable of the spec.",
        howToCollect:
          "Open the Pareto chart — the app keeps it sorted automatically. If you set spec limits on an SPC stream, review the capability report: Cpk below your threshold means the process cannot reliably hold the spec even when nothing unusual happens.",
        moduleHint: { label: "Open Pareto analysis", href: (p) => `/p/${p}/nc` },
        gate: {
          key: "analyze_focus",
          question: "Based on the Pareto and capability results, where should the team focus first?",
          options: [
            { value: "top_defect", label: "Attack the #1 defect code", rationale: "Largest single contributor; fastest visible impact if a specific cause can be found." },
            { value: "capability", label: "Fix process capability (re-center or reduce variation)", rationale: "If Cpk is below threshold, individual defect-chasing won't help — the process itself can't hold the spec." },
            { value: "measurement", label: "Verify the measurement first", rationale: "If data looks inconsistent between people/shifts, confirm the measurement system before trusting any conclusion (full Gage R&R module arrives in Phase 2)." },
          ],
        },
      },
      {
        key: "improve",
        phase: "Improve",
        title: "Implement and track corrective action",
        why: "An improvement that isn't written down, owned, and dated is a conversation, not a corrective action.",
        howToCollect:
          "Create (or confirm the auto-drafted) CAPA: root cause, corrective action, owner, due date. If the app auto-drafted one from a recurring defect, review it — don't rubber-stamp it.",
        moduleHint: { label: "Open CAPA register", href: (p) => `/p/${p}/capa` },
        gate: {
          key: "improve_action",
          question: "What did the team decide to implement?",
          options: [
            { value: "process_change", label: "Process change", rationale: "Alters the method/parameters — strongest fix when root cause is in the process itself." },
            { value: "error_proofing", label: "Error-proofing (poka-yoke)", rationale: "Makes the mistake physically hard to commit — most durable for human-factor causes." },
            { value: "training_standard", label: "Training + standard work update", rationale: "Right when the method is fine but inconsistently followed; weakest as a standalone fix, so pair with a check." },
            { value: "containment", label: "Interim containment (100% inspection)", rationale: "Protects the customer now; not a fix — must be paired with a real corrective action and an exit date." },
          ],
        },
      },
      {
        key: "control",
        phase: "Control",
        title: "Lock in the gain",
        why: "Without ongoing monitoring, processes drift back. A live control chart with automatic out-of-control flags is your tripwire.",
        howToCollect:
          "Keep logging the SPC stream after the change. The app flags Western Electric rule violations automatically and alerts you on the dashboard. Update the FMEA occurrence score for the addressed failure mode, and schedule a recurring review task.",
        moduleHint: { label: "Open control charts", href: (p) => `/p/${p}/spc` },
        inputs: [
          { key: "control_plan", label: "How will this stay controlled? (who checks what, how often)", textarea: true },
        ],
      },
    ],
  },
};
