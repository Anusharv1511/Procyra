import {
  pgTable, text, timestamp, integer, doublePrecision, jsonb, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());

// ---- Accounts & tenancy ---------------------------------------------------

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  industry: text("industry").notNull().default("general"),
  processType: text("process_type").notNull().default("discrete"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Membership exists from day one so team sharing later is additive, not a rebuild.
export const memberships = pgTable("memberships", {
  id: id(),
  role: text("role").notNull().default("owner"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
}, (t) => ({ uq: uniqueIndex("membership_user_ws").on(t.userId, t.workspaceId) }));

export const projects = pgTable("projects", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Soft-delete: archived projects are hidden from default lists, never destroyed.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  // Public read-only share link: /share/[shareToken]. Null = no active link.
  // Cryptographically random (crypto.randomBytes), unique so a token resolves
  // to at most one project; revoking sets it back to null (the old URL 404s).
  shareToken: text("share_token").unique(),
});

// ---- Platform layer: Data Streams ------------------------------------------
// Any logged time-series (SPC subgroups, daily OEE) is a Stream. Rules run on entry.

export const streams = pgTable("streams", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // SPC_XBAR_R | SPC_IMR | OEE
  unit: text("unit"),
  subgroupSize: integer("subgroup_size").notNull().default(1),
  specLow: doublePrecision("spec_low"),
  specHigh: doublePrecision("spec_high"),
  target: doublePrecision("target"), // OEE target as fraction (e.g. 0.85)
  cpkThreshold: doublePrecision("cpk_threshold").notNull().default(1.33),
  cadence: text("cadence").notNull().default("daily"), // staleness indicator
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dataPoints = pgTable("data_points", {
  id: id(),
  streamId: text("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  // SPC: { values: number[] } — OEE: { planned, runtime, idealCycle, total, good }
  payload: jsonb("payload").notNull(),
  // written by the rules engine on entry: { mean, range, oee, flags: [{rule, message}] }
  computed: jsonb("computed"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ byStream: index("dp_stream_ts").on(t.streamId, t.ts) }));

// ---- Platform layer: Alerts -------------------------------------------------

export const alerts = pgTable("alerts", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  streamId: text("stream_id").references(() => streams.id, { onDelete: "set null" }),
  sourceType: text("source_type").notNull(), // SPC | CAPABILITY | OEE | NC | FMEA | TASK
  sourceId: text("source_id"),
  ruleCode: text("rule_code").notNull(), // WE1..WE4 | CPK_LOW | OEE_BELOW_TARGET | NC_REPEAT | RPN_THRESHOLD
  severity: text("severity").notNull().default("warning"),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // open | acknowledged | resolved
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => ({ byProject: index("alert_project_status").on(t.projectId, t.status) }));

// ---- Quality loop -------------------------------------------------------------

export const nonConformances = pgTable("non_conformances", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  defectCode: text("defect_code").notNull(),
  processArea: text("process_area").notNull(),
  qty: integer("qty").notNull().default(1),
  severity: text("severity").notNull().default("minor"),
  description: text("description"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ byCode: index("nc_code").on(t.projectId, t.defectCode, t.processArea) }));

export const capas = pgTable("capas", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source").notNull().default("manual"), // manual | auto
  linkedDefectCode: text("linked_defect_code"),
  status: text("status").notNull().default("open"), // draft | open | in_progress | closed | verified
  owner: text("owner"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  rootCause: text("root_cause"),
  correctiveAction: text("corrective_action"),
  preventiveAction: text("preventive_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fmeas = pgTable("fmeas", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("PFMEA"),
  rpnAction: integer("rpn_action").notNull().default(100), // alert when RPN crosses it
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fmeaItems = pgTable("fmea_items", {
  id: id(),
  fmeaId: text("fmea_id").notNull().references(() => fmeas.id, { onDelete: "cascade" }),
  processStep: text("process_step").notNull(),
  failureMode: text("failure_mode").notNull(),
  effect: text("effect"),
  cause: text("cause"),
  severity: integer("severity").notNull().default(1),
  occurrence: integer("occurrence").notNull().default(1),
  detection: integer("detection").notNull().default(1),
  rpn: integer("rpn").notNull().default(1), // always recomputed server-side as S*O*D
  recommendedAction: text("recommended_action"),
  actionStatus: text("action_status").notNull().default("none"),
  linkedDefectCode: text("linked_defect_code"),
});

// ---- IE anchor: time study -----------------------------------------------------

export const timeStudies = pgTable("time_studies", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  personalPct: doublePrecision("personal_pct").notNull().default(5),
  fatiguePct: doublePrecision("fatigue_pct").notNull().default(4),
  delayPct: doublePrecision("delay_pct").notNull().default(3),
  learningCurvePct: doublePrecision("learning_curve_pct").notNull().default(90),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const timeStudyElements = pgTable("time_study_elements", {
  id: id(),
  studyId: text("study_id").notNull().references(() => timeStudies.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  description: text("description").notNull(),
  observations: jsonb("observations").notNull(), // number[]
  rating: doublePrecision("rating").notNull().default(100),
});

// ---- Platform layer: Scheduler ---------------------------------------------------

export const scheduledTasks = pgTable("scheduled_tasks", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  recurrence: text("recurrence").notNull(), // daily | weekly | monthly | quarterly
  nextDue: timestamp("next_due", { withTimezone: true }).notNull(),
  lastCompleted: timestamp("last_completed", { withTimezone: true }),
  assignee: text("assignee"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---- Platform layer: Guided Mode (playbooks + decision log) -----------------------

export const playbookRuns = pgTable("playbook_runs", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  playbookKey: text("playbook_key").notNull(), // reduce_defects
  stepIndex: integer("step_index").notNull().default(0),
  state: jsonb("state").notNull().default({}),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---- Phase 2/3 modules (ADDITIVE — migration 0003) --------------------------
// Child rows that are always read/written as a unit (stations, DOE runs,
// changeover steps, CPM tasks, audit responses, the Gage R&R measurement grid)
// live in jsonb on their parent, mirroring how dataPoints.payload and
// timeStudyElements.observations already work in this codebase.

// Part A — Gage R&R / MSA. data = measurements[operator][part][trial] (nulls until entered).
export const gageStudies = pgTable("gage_studies", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parts: integer("parts").notNull().default(10),
  operators: integer("operators").notNull().default(3),
  trials: integer("trials").notNull().default(3),
  tolerance: doublePrecision("tolerance"), // USL - LSL; %Tolerance shown only when present
  data: jsonb("data").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part B — Line balancing. stations = [{ name, cycleTime }] (same time unit as availableTime).
export const lineBalances = pgTable("line_balances", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  availableTime: doublePrecision("available_time").notNull(), // minutes per period
  requiredOutput: doublePrecision("required_output").notNull(), // units per period
  stations: jsonb("stations").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part C — DOE. factors = [{ name, low, high }]; runs = [{ levels: (-1|1)[], response: number|null }].
export const doeStudies = pgTable("doe_studies", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  designType: text("design_type").notNull().default("full"), // full | half (2^(k-1), k=4 only)
  responseName: text("response_name").notNull().default("Response"),
  factors: jsonb("factors").notNull().default([]),
  runs: jsonb("runs").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part E — SMED / changeover. steps = [{ description, duration, kind: "internal"|"external" }].
export const changeovers = pgTable("changeovers", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  line: text("line").notNull(),
  date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  steps: jsonb("steps").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part F — Acceptance sampling (ANSI/ASQ Z1.4-style, single, normal, level II).
export const samplingPlans = pgTable("sampling_plans", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lotSize: integer("lot_size").notNull(),
  aql: doublePrecision("aql").notNull(),
  sampleSize: integer("sample_size").notNull(),
  acceptNum: integer("accept_num").notNull(),
  defectsFound: integer("defects_found"), // null until inspection is recorded
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part G — Control plan register (one row per controlled characteristic).
export const controlPlanItems = pgTable("control_plan_items", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  characteristic: text("characteristic").notNull(),
  specification: text("specification"),
  controlMethod: text("control_method").notNull(),
  frequency: text("frequency").notNull(),
  reactionPlan: text("reaction_plan"),
  linkedStreamId: text("linked_stream_id").references(() => streams.id, { onDelete: "set null" }),
  linkedFmeaItemId: text("linked_fmea_item_id").references(() => fmeaItems.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part H — 8D problem solving. disciplines = { d1..d8: string }.
export const eightDs = pgTable("eight_ds", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"), // open | closed
  currentStep: integer("current_step").notNull().default(1), // 1..8
  disciplines: jsonb("disciplines").notNull().default({}),
  linkedCapaId: text("linked_capa_id").references(() => capas.id, { onDelete: "set null" }),
  linkedDefectCode: text("linked_defect_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part I — Audit checklist runs. responses = { [questionId]: { result: "pass"|"fail"|"na", note } }.
export const auditRuns = pgTable("audit_runs", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  standard: text("standard").notNull().default("IATF 16949"),
  responses: jsonb("responses").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part J — Capacity & bottlenecks. steps = [{ name, cycleTime, availableTime }].
export const capacityStudies = pgTable("capacity_studies", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  steps: jsonb("steps").notNull().default([]),
  sourceLineBalanceId: text("source_line_balance_id").references(() => lineBalances.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part K — Inventory (EOQ / ABC).
export const skus = pgTable("skus", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  annualDemand: doublePrecision("annual_demand").notNull(),
  orderCost: doublePrecision("order_cost").notNull(),
  holdingCost: doublePrecision("holding_cost").notNull(), // per unit per year
  unitCost: doublePrecision("unit_cost").notNull().default(0), // for ABC dollar volume
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Part L — Gantt / CPM. tasks = [{ key, name, duration, preds: string[] }].
export const cpmPlans = pgTable("cpm_plans", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tasks: jsonb("tasks").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Human-in-the-loop decision log: the app suggests, people decide, both are recorded.
export const decisions = pgTable("decisions", {
  id: id(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => playbookRuns.id, { onDelete: "set null" }),
  gateKey: text("gate_key").notNull(),
  question: text("question").notNull(),
  suggested: jsonb("suggested").notNull(), // options the app presented, with rationale
  chosen: text("chosen").notNull(), // what the team actually decided
  rationale: text("rationale"),
  decidedBy: text("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
