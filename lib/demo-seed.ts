// Part A1 — "Load example project": seeds a complete, realistic DMAIC demo.
//
// Design rule: wherever practical the seed goes through the SAME code paths a
// real user exercises — every SPC/OEE point runs runSpcRules/runOeeRules on
// entry, every defect runs runNcRules (so the 3x-recurring defect auto-drafts
// its CAPA via the real recurrence logic), FMEA items are saved through the
// real upsertFmeaItem action (server-side RPN + threshold alert), the playbook
// is advanced step-by-step through the real advancePlaybook action (which logs
// decisions), and alerts are resolved through the real setAlertStatus action.
// Nothing is written into `computed`, `alerts`, `decisions`, or `capas` by hand.
//
// The only deviations from the interactive path (each commented inline):
//  - rows that need a *backdated* timestamp (SPC points, OEE entries, defect
//    dates) are inserted directly and then handed to the exact same rules
//    function the interactive action calls — the interactive actions always
//    stamp "now", which would put 25 chart points on one day;
//  - `createStream`, `createFmea`, and `startPlaybook` end in redirect(),
//    which would abort the seed, so their single-row inserts are mirrored here.

import { db, t } from "@/db";
import { and, eq, asc, like } from "drizzle-orm";
import { runSpcRules, runOeeRules, runNcRules } from "@/lib/rules";

type ActionFn = (prev: any, fd: FormData) => Promise<any>;
export type SeedDeps = {
  advancePlaybook: ActionFn;
  upsertFmeaItem: ActionFn;
  setAlertStatus: ActionFn;
};

const fd = (obj: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
};

const daysAgo = (n: number, hour = 10, minute = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
};

// Flange OD (mm), nominal 25.000, LSL 24.979 / USL 25.021.
// First 15 points: stable, in control, Cpk ≈ 1.4–1.5 (capable).
// Last 10 points: sustained upward tool-wear drift. Verified against the real
// lib/spc.ts math to trigger WE3 (pt 20–25), WE4 (pt 23–25), WE2 (pt 24–25)
// and WE1 (pt 25), and to drop rolling Cpk below the 1.33 threshold on the
// final point — so the CPK_LOW alert fires naturally from runSpcRules.
const SPC_VALUES = [
  25.002, 24.996, 25.004, 24.998, 25.001, 24.995, 25.003, 25.000,
  24.997, 25.005, 24.999, 25.002, 24.996, 25.001, 24.998,
  25.006, 25.009, 25.007, 25.012, 25.008, 25.011, 25.014, 25.010, 25.013, 25.019,
];

// One OEE entry per day for the last 4 days; day 3 is a bad day (breakdown).
const OEE_ENTRIES = [
  { planned: 480, runtime: 450, idealCycle: 0.9, total: 470, good: 462 }, // ≈ 86.6%
  { planned: 480, runtime: 455, idealCycle: 0.9, total: 478, good: 470 }, // ≈ 88.1%
  { planned: 480, runtime: 390, idealCycle: 0.9, total: 380, good: 362 }, // ≈ 67.9% — below target
  { planned: 480, runtime: 452, idealCycle: 0.9, total: 468, good: 461 }, // ≈ 86.4%
];

// Defect log: 3 × OD-OVERSIZE in the same area within the 30-day window fires
// the real recurrence rule (automotive threshold = 3) → auto-drafted CAPA.
const DEFECTS: { day: number; code: string; area: string; qty: number; severity: string; description: string }[] = [
  { day: 20, code: "BURR", area: "Deburr bench", qty: 2, severity: "minor", description: "Burr on inner bore edge after parting" },
  { day: 18, code: "OD-OVERSIZE", area: "CNC lathe 2", qty: 1, severity: "major", description: "OD 25.024 mm vs USL 25.021 — caught at in-process check" },
  { day: 15, code: "SURFACE-FINISH", area: "CNC lathe 2", qty: 1, severity: "minor", description: "Ra above 1.6 on sealing face" },
  { day: 12, code: "OD-OVERSIZE", area: "CNC lathe 2", qty: 1, severity: "major", description: "OD 25.023 mm — same insert position as last occurrence" },
  { day: 9, code: "CHAMFER-MISS", area: "CNC lathe 1", qty: 1, severity: "minor", description: "Chamfer skipped after program restart" },
  { day: 7, code: "BURR", area: "Deburr bench", qty: 1, severity: "minor", description: "Burr on oil groove" },
  { day: 4, code: "OD-OVERSIZE", area: "CNC lathe 2", qty: 2, severity: "major", description: "Two flanges oversize at final inspection — insert wear suspected" },
  { day: 2, code: "POROSITY", area: "Casting receiving", qty: 1, severity: "critical", description: "Porosity exposed after facing — supplier lot 2231" },
];

const FMEA_ITEMS = [
  {
    processStep: "OP20 — Turn OD", failureMode: "OD oversize",
    effect: "Flange will not seat in mating bore; leak path at assembly", cause: "Insert flank wear not compensated between checks",
    severity: "7", occurrence: "5", detection: "4", // RPN 140 — above the 100 action threshold → real RPN_THRESHOLD alert
    recommendedAction: "Add wear-offset compensation every 50 parts; tighten SPC reaction plan",
    actionStatus: "open", linkedDefectCode: "OD-OVERSIZE",
  },
  {
    processStep: "OP40 — Deburr", failureMode: "Burr remains on bore edge",
    effect: "Seal damage at assembly; operator handling injury risk", cause: "Worn deburr brush; no brush-life tracking",
    severity: "5", occurrence: "4", detection: "3", // RPN 60
    recommendedAction: "Add brush change to recurring maintenance task",
    actionStatus: "open", linkedDefectCode: "BURR",
  },
  {
    processStep: "OP20 — Face seal surface", failureMode: "Surface finish out of spec (Ra > 1.6)",
    effect: "Gasket will not seal reliably", cause: "Feed override raised to catch up after downtime",
    severity: "4", occurrence: "3", detection: "4", // RPN 48
    recommendedAction: "Lock feed override on finishing pass",
    actionStatus: "none", linkedDefectCode: "SURFACE-FINISH",
  },
  {
    processStep: "OP30 — Drill + chamfer", failureMode: "Chamfer missing after program restart",
    effect: "Sharp edge; fastener cross-threads at assembly", cause: "Restart mid-cycle skips chamfer block",
    severity: "6", occurrence: "2", detection: "2", // RPN 24
    recommendedAction: "Restart-from-toolchange-only rule in program header",
    actionStatus: "none", linkedDefectCode: "CHAMFER-MISS",
  },
];

export async function seedDemoProjectData(userId: string, deps: SeedDeps): Promise<{ projectId: string }> {
  // ---- 1. Demo workspace (automotive → real industry terminology/defaults) --
  // Reuse the user's demo workspace if they already loaded an example before;
  // otherwise create it, exactly as createWorkspace would (minus its redirect).
  const mine = await db
    .select({ ws: t.workspaces })
    .from(t.memberships)
    .innerJoin(t.workspaces, eq(t.workspaces.id, t.memberships.workspaceId))
    .where(eq(t.memberships.userId, userId));
  let ws = mine.map(r => r.ws).find(w => w.name === "Demo — Automotive" && w.industry === "automotive");
  if (!ws) {
    [ws] = await db.insert(t.workspaces).values({
      name: "Demo — Automotive", industry: "automotive", processType: "discrete",
    }).returning();
    await db.insert(t.memberships).values({ userId, workspaceId: ws.id, role: "owner" });
  }

  // ---- 2. Brand-new project, never overwriting an existing one -------------
  const baseName = "Demo: Flange Machining";
  const clashes = await db.select({ name: t.projects.name }).from(t.projects)
    .where(and(eq(t.projects.workspaceId, ws.id), like(t.projects.name, `${baseName}%`)));
  const name = clashes.length === 0 ? baseName : `${baseName} (${clashes.length + 1})`;
  const [project] = await db.insert(t.projects).values({
    workspaceId: ws.id, name,
    description: "Seeded example — a complete DMAIC pass on flange OD defects. Every alert, CAPA and decision below was generated by the app's own rules, not inserted by hand.",
  }).returning();

  // ---- 3. SPC stream (I-MR) + 25 backdated points through runSpcRules ------
  // Direct stream insert mirrors createStream (which redirects); field shapes identical.
  const [spcStream] = await db.insert(t.streams).values({
    projectId: project.id, name: "Flange OD — CNC lathe 2", type: "SPC_IMR",
    unit: "mm", subgroupSize: 1, specLow: 24.979, specHigh: 25.021, cpkThreshold: 1.33,
  }).returning();
  for (let i = 0; i < SPC_VALUES.length; i++) {
    // Same two steps addSpcPoint performs (insert → runSpcRules), plus an
    // explicit backdated ts so the chart spans ~4 weeks instead of one day.
    const [pt] = await db.insert(t.dataPoints).values({
      streamId: spcStream.id, ts: daysAgo(SPC_VALUES.length - i),
      payload: { values: [SPC_VALUES[i]] },
    }).returning();
    await runSpcRules(spcStream.id, pt.id); // WE flags + CPK_LOW fire here, for real
  }

  // ---- 4. OEE stream + 4 backdated daily entries through runOeeRules -------
  const [oeeStream] = await db.insert(t.streams).values({
    projectId: project.id, name: "CNC lathe 2 — daily OEE", type: "OEE",
    subgroupSize: 1, target: 0.85,
  }).returning();
  for (let i = 0; i < OEE_ENTRIES.length; i++) {
    // Same two steps addOeePoint performs (insert → runOeeRules) + backdated ts.
    const [pt] = await db.insert(t.dataPoints).values({
      streamId: oeeStream.id, ts: daysAgo(OEE_ENTRIES.length - i, 18, 0),
      payload: OEE_ENTRIES[i],
    }).returning();
    await runOeeRules(oeeStream.id, pt.id);
  }

  // ---- 5. Defect log through runNcRules (auto-CAPA fires on 3rd repeat) ----
  for (const d of DEFECTS) {
    // Same two steps addNc performs (insert → runNcRules) + backdated date so
    // the recurrence window logic evaluates realistic dates.
    const [nc] = await db.insert(t.nonConformances).values({
      projectId: project.id, date: daysAgo(d.day, 14, 0),
      defectCode: d.code, processArea: d.area, qty: d.qty,
      severity: d.severity, description: d.description,
    }).returning();
    await runNcRules(project.id, nc.id, "automotive");
  }

  // ---- 6. FMEA through the real upsertFmeaItem action ----------------------
  // Direct FMEA-header insert mirrors createFmea (which redirects).
  const [fmea] = await db.insert(t.fmeas).values({
    projectId: project.id, name: "Flange machining PFMEA", type: "PFMEA", rpnAction: 100,
  }).returning();
  for (const item of FMEA_ITEMS) {
    await deps.upsertFmeaItem(null, fd({
      projectId: project.id, fmeaId: fmea.id, id: "", ...item,
    })); // RPN recomputed server-side; the 140-RPN row raises RPN_THRESHOLD itself
  }

  // ---- 7. Completed playbook run through the real advancePlaybook action ---
  // Direct run insert mirrors startPlaybook (which redirects); the five steps
  // (including both decision gates → decision log rows) go through the action.
  const [run] = await db.insert(t.playbookRuns).values({
    projectId: project.id, playbookKey: "reduce_defects",
  }).returning();
  const steps: Record<string, string>[] = [
    { // Define
      process: "Flange OD turning — CNC lathe 2, day shift",
      problem: "OD-oversize rejects tripled since the insert brand change in week 22: now ~4 per 100 flanges at final inspection, concentrated on lathe 2.",
      metric: "OD-oversize defects per 100 flanges",
    },
    { baseline_days: "15" }, // Measure
    { // Analyze — decision gate
      gate_choice: "Attack the #1 defect code",
      gate_rationale: "Pareto shows OD-OVERSIZE is the top bar and capability confirms the drift: Cpk fell below 1.33 as the tool-wear trend developed.",
      gate_decidedBy: "Machining kaizen team",
    },
    { // Improve — decision gate
      gate_choice: "Process change",
      gate_rationale: "Root cause is uncompensated insert flank wear — add automatic wear-offset compensation every 50 parts instead of relying on operator checks.",
      gate_decidedBy: "Machining kaizen team",
    },
    { // Control
      control_plan: "Keep logging Flange OD on the I-MR chart every shift; setter reviews the chart at shift start; SPC alerts stop the lathe pending offset check; FMEA occurrence for OD oversize re-scored after 30 days of data.",
    },
  ];
  for (const step of steps) {
    await deps.advancePlaybook(null, fd({ projectId: project.id, runId: run.id, ...step }));
  }

  // ---- 8. Resolve a couple of the naturally-raised alerts ------------------
  // Through the same setAlertStatus action the Resolve button uses, so
  // resolvedAt is stamped the same way. The first two flagged SPC entries are
  // "old news" the demo team already dealt with; later ones stay open.
  const spcAlerts = await db.select().from(t.alerts).where(and(
    eq(t.alerts.projectId, project.id), eq(t.alerts.sourceType, "SPC"),
  )).orderBy(asc(t.alerts.createdAt));
  const firstTwoEntries = Array.from(new Set(spcAlerts.map(a => a.sourceId))).slice(0, 2);
  for (const a of spcAlerts.filter(a => firstTwoEntries.includes(a.sourceId))) {
    await deps.setAlertStatus(null, fd({ projectId: project.id, id: a.id, status: "resolved" }));
  }

  return { projectId: project.id };
}
