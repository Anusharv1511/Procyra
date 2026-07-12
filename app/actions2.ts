"use server";

// Server actions for the Phase 2/3 modules (Parts A–L), the guided flow
// (Part P), demo seeds (Part O), and the alert→CAPA quick action (Part N).
// Kept in a separate file from app/actions.ts so every existing action is
// byte-for-byte untouched; the same auth / validation / revalidate patterns
// are followed throughout.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { and, eq } from "drizzle-orm";
import { getSessionUserId, requireProjectAccess } from "@/lib/auth";
import { emptyGrid, gageRnR } from "@/lib/gagerr";
import { generateRuns } from "@/lib/doe";
import { runYieldRules } from "@/lib/yield";
import { singleSamplingPlan } from "@/lib/sampling";
import { cpm, CpmTask } from "@/lib/cpm";
import { GUIDED_INTAKE, recommendTools, SHORTLIST_STEPS, TOOL_META, ToolKey } from "@/lib/guided";
import { latestToolResult } from "@/lib/guided-data";
import { PLAYBOOKS } from "@/lib/playbooks";
import { seedSemiconductorDemo, seedLogisticsDemo } from "@/lib/demo-seed-extra";
import { advancePlaybook, upsertFmeaItem, setAlertStatus } from "@/app/actions";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === "" ? null : Number(v);
};
const json = <T,>(fd: FormData, k: string, fallback: T): T => {
  try { return JSON.parse(s(fd, k)) as T; } catch { return fallback; }
};

// ---------- Part A: Gage R&R ----------
export async function createGageStudy(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const parts = Math.min(Math.max(num(fd, "parts") ?? 10, 2), 15);
  const operators = Math.min(Math.max(num(fd, "operators") ?? 3, 2), 5);
  const trials = Math.min(Math.max(num(fd, "trials") ?? 3, 2), 3);
  const [study] = await db.insert(t.gageStudies).values({
    projectId, name, parts, operators, trials,
    tolerance: num(fd, "tolerance"),
    data: emptyGrid(operators, parts, trials),
  }).returning();
  redirect(`/p/${projectId}/gagerr/${study.id}`);
}

export async function saveGageData(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), studyId = s(fd, "studyId");
  await requireProjectAccess(projectId);
  const [study] = await db.select().from(t.gageStudies).where(eq(t.gageStudies.id, studyId));
  if (!study || study.projectId !== projectId) return { error: "Study not found." };
  const grid = json<(number | null)[][][]>(fd, "grid", []);
  if (grid.length !== study.operators || grid[0]?.length !== study.parts || grid[0]?.[0]?.length !== study.trials)
    return { error: "Grid shape doesn't match the study definition." };
  const clean = grid.map(op => op.map(p => p.map(v => (v == null || isNaN(Number(v)) ? null : Number(v)))));
  await db.update(t.gageStudies).set({ data: clean }).where(eq(t.gageStudies.id, studyId));

  // Alert on unacceptable %GRR through the existing alert system, with the
  // same open-alert dedupe pattern the other rules use.
  const result = gageRnR(clean, study.tolerance);
  let flagged = false;
  if ("pctGrr" in result && result.pctGrr > 30) {
    flagged = true;
    const open = await db.select().from(t.alerts).where(and(
      eq(t.alerts.sourceId, studyId), eq(t.alerts.ruleCode, "GRR_UNACCEPTABLE"), eq(t.alerts.status, "open")));
    if (open.length === 0) {
      await db.insert(t.alerts).values({
        projectId, sourceType: "MSA", sourceId: studyId,
        ruleCode: "GRR_UNACCEPTABLE", severity: "critical",
        message: `${study.name}: %GRR ${result.pctGrr.toFixed(1)}% > 30% — measurement system unacceptable (AIAG); data from this gage should not drive decisions until fixed`,
      });
    }
  }
  revalidatePath(`/p/${projectId}/gagerr/${studyId}`);
  return {
    ok: true, flagged,
    message: "pctGrr" in result
      ? `Saved — %GRR ${result.pctGrr.toFixed(1)}% (${result.verdict})${flagged ? ". Alert raised." : "."}`
      : "Saved — enter the remaining measurements to compute results.",
  };
}

// ---------- Part B: Line balancing ----------
export async function createLineBalance(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  const availableTime = num(fd, "availableTime"), requiredOutput = num(fd, "requiredOutput");
  if (!name || !availableTime || !requiredOutput || availableTime <= 0 || requiredOutput <= 0)
    return { error: "Name, available time, and required output (both positive) are required." };
  const [lb] = await db.insert(t.lineBalances).values({
    projectId, name, availableTime, requiredOutput, stations: [],
  }).returning();
  redirect(`/p/${projectId}/linebalance/${lb.id}`);
}

export async function saveLineBalanceStations(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  const [lb] = await db.select().from(t.lineBalances).where(eq(t.lineBalances.id, id));
  if (!lb || lb.projectId !== projectId) return { error: "Study not found." };
  const stations = json<{ name: string; cycleTime: number }[]>(fd, "rows", [])
    .map(r => ({ name: String(r.name ?? "").trim(), cycleTime: Number(r.cycleTime) }))
    .filter(r => r.name && !isNaN(r.cycleTime) && r.cycleTime > 0);
  if (!stations.length) return { error: "Add at least one station with a positive cycle time." };
  await db.update(t.lineBalances).set({ stations }).where(eq(t.lineBalances.id, id));

  // Alert when any station's cycle time exceeds takt (demand can't be met there),
  // same open-alert dedupe pattern as the other rules.
  const takt = lb.availableTime / lb.requiredOutput;
  const over = stations.filter(st => st.cycleTime > takt);
  if (over.length) {
    const open = await db.select().from(t.alerts).where(and(
      eq(t.alerts.sourceId, id), eq(t.alerts.ruleCode, "STATION_OVER_TAKT"), eq(t.alerts.status, "open")));
    if (open.length === 0) {
      await db.insert(t.alerts).values({
        projectId, sourceType: "LINE_BALANCE", sourceId: id,
        ruleCode: "STATION_OVER_TAKT", severity: "warning",
        message: `${lb.name}: ${over.map(o => o.name).join(", ")} exceed${over.length === 1 ? "s" : ""} takt time (${takt.toFixed(1)}) — demand cannot be met there`,
      });
    }
  }
  revalidatePath(`/p/${projectId}/linebalance/${id}`);
  return { ok: true, flagged: over.length > 0, message: over.length ? `Saved — ${over.length} station(s) over takt. Alert raised.` : "Saved — all stations within takt." };
}

// ---------- Part C: DOE ----------
export async function createDoe(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name"), responseName = s(fd, "responseName") || "Response";
  const factors = json<{ name: string; low: string; high: string }[]>(fd, "rows", [])
    .map(f => ({ name: String(f.name ?? "").trim(), low: String(f.low ?? "").trim() || "low", high: String(f.high ?? "").trim() || "high" }))
    .filter(f => f.name);
  if (!name) return { error: "Name is required." };
  if (factors.length < 2 || factors.length > 4) return { error: "Enter 2 to 4 factors." };
  const designType = factors.length === 4 && s(fd, "designType") === "half" ? "half" : "full";
  const runs = generateRuns(factors.length, designType as "full" | "half")
    .map(levels => ({ levels, response: null as number | null }));
  const [study] = await db.insert(t.doeStudies).values({
    projectId, name, responseName, designType, factors, runs,
  }).returning();
  redirect(`/p/${projectId}/doe/${study.id}`);
}

export async function saveDoeResponses(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  const [study] = await db.select().from(t.doeStudies).where(eq(t.doeStudies.id, id));
  if (!study || study.projectId !== projectId) return { error: "Study not found." };
  const runs = (study.runs as any[]).map((r, i) => {
    const v = s(fd, `response_${i}`);
    return { levels: r.levels, response: v === "" ? null : Number(v) };
  });
  if (runs.some(r => r.response != null && isNaN(r.response))) return { error: "Responses must be numbers." };
  await db.update(t.doeStudies).set({ runs }).where(eq(t.doeStudies.id, id));
  revalidatePath(`/p/${projectId}/doe/${id}`);
  const remaining = runs.filter(r => r.response == null).length;
  return { ok: true, message: remaining ? `Saved — ${remaining} run${remaining === 1 ? "" : "s"} still need a response.` : "Saved — all runs complete; effects computed below." };
}

// ---------- Part D: Yield ----------
export async function createYieldStream(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const threshold = num(fd, "threshold"); // entered as %
  const [stream] = await db.insert(t.streams).values({
    projectId, name, type: "YIELD", subgroupSize: 1,
    target: threshold != null ? Math.min(Math.max(threshold / 100, 0.01), 1) : 0.95,
  }).returning();
  redirect(`/p/${projectId}/yield/${stream.id}`);
}

export async function addYieldEntry(_prev: any, fd: FormData) {
  const streamId = s(fd, "streamId"), projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const started = num(fd, "started"), passed = num(fd, "passed");
  if (started == null || passed == null || started <= 0 || passed < 0 || isNaN(started) || isNaN(passed))
    return { error: "Units started (positive) and passed (non-negative) are required." };
  if (passed > started) return { error: "Passed cannot exceed started." };
  // Scrap reasons: one per line, "reason: qty" (qty defaults to 1).
  const scrap = s(fd, "scrap").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)[:x]\s*(\d+)\s*$/i);
    return m ? { reason: m[1].trim(), qty: Number(m[2]) } : { reason: l, qty: 1 };
  }).filter(x => x.reason && x.qty > 0);
  const [pt] = await db.insert(t.dataPoints).values({
    streamId, payload: { started, passed, scrap },
  }).returning();
  const c = await runYieldRules(streamId, pt.id); // rules run automatically on entry
  revalidatePath(`/p/${projectId}/yield/${streamId}`);
  return { ok: true, message: c ? `Logged — FPY ${(c.fpy * 100).toFixed(1)}%` : "Logged." };
}

// ---------- Part E: SMED ----------
export async function addChangeover(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const line = s(fd, "line");
  if (!line) return { error: "Line / machine is required." };
  const steps = json<{ description: string; duration: number; kind: string }[]>(fd, "rows", [])
    .map(r => ({
      description: String(r.description ?? "").trim(),
      duration: Number(r.duration),
      kind: r.kind === "external" ? "external" as const : "internal" as const,
    }))
    .filter(r => r.description && !isNaN(r.duration) && r.duration > 0);
  if (!steps.length) return { error: "Add at least one step with a positive duration." };
  const dateRaw = s(fd, "date");
  const [co] = await db.insert(t.changeovers).values({
    projectId, line, steps, ...(dateRaw ? { date: new Date(dateRaw + "T12:00:00") } : {}),
  }).returning();
  redirect(`/p/${projectId}/smed/${co.id}`);
}

// ---------- Part F: Acceptance sampling ----------
export async function createSamplingPlan(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name"), lotSize = num(fd, "lotSize"), aql = num(fd, "aql");
  if (!name || lotSize == null || aql == null) return { error: "Name, lot size, and AQL are required." };
  const plan = singleSamplingPlan(Math.round(lotSize), aql);
  if ("error" in plan) return { error: plan.error };
  await db.insert(t.samplingPlans).values({
    projectId, name, lotSize: Math.round(lotSize), aql,
    sampleSize: plan.sampleSize, acceptNum: plan.acceptNum,
  });
  revalidatePath(`/p/${projectId}/sampling`);
  return { ok: true, message: `Plan created — code ${plan.codeLetter}, inspect n = ${plan.sampleSize}, accept on ≤ ${plan.acceptNum} defects.${plan.note ? " " + plan.note : ""}` };
}

export async function recordSamplingResult(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  const defects = num(fd, "defectsFound");
  if (defects == null || defects < 0 || !Number.isInteger(defects))
    return { error: "Defects found must be a non-negative whole number." };
  const [plan] = await db.select().from(t.samplingPlans).where(eq(t.samplingPlans.id, id));
  if (!plan || plan.projectId !== projectId) return { error: "Plan not found." };
  await db.update(t.samplingPlans).set({ defectsFound: defects }).where(eq(t.samplingPlans.id, id));
  revalidatePath(`/p/${projectId}/sampling`);
  const accept = defects <= plan.acceptNum;
  return { ok: true, flagged: !accept, message: accept ? `ACCEPT — ${defects} ≤ Ac ${plan.acceptNum}.` : `REJECT — ${defects} ≥ Re ${plan.acceptNum + 1}.` };
}

// ---------- Part G: Control plans ----------
export async function addControlPlanItem(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const characteristic = s(fd, "characteristic"), controlMethod = s(fd, "controlMethod"), frequency = s(fd, "frequency");
  if (!characteristic || !controlMethod || !frequency)
    return { error: "Characteristic, control method, and frequency are required." };
  await db.insert(t.controlPlanItems).values({
    projectId, characteristic, controlMethod, frequency,
    specification: s(fd, "specification") || null,
    reactionPlan: s(fd, "reactionPlan") || null,
    linkedStreamId: s(fd, "linkedStreamId") || null,
    linkedFmeaItemId: s(fd, "linkedFmeaItemId") || null,
  });
  revalidatePath(`/p/${projectId}/controlplans`);
  return { ok: true, message: "Characteristic added to the control plan." };
}

export async function deleteControlPlanItem(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  await db.delete(t.controlPlanItems).where(and(
    eq(t.controlPlanItems.id, id), eq(t.controlPlanItems.projectId, projectId)));
  revalidatePath(`/p/${projectId}/controlplans`);
  return { ok: true, message: "Row removed." };
}

// ---------- Part H: 8D ----------
export async function create8D(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const title = s(fd, "title");
  if (!title) return { error: "Title is required." };
  const [ed] = await db.insert(t.eightDs).values({
    projectId, title,
    linkedCapaId: s(fd, "linkedCapaId") || null,
    linkedDefectCode: s(fd, "linkedDefectCode") || null,
  }).returning();
  redirect(`/p/${projectId}/8d/${ed.id}`);
}

export async function save8DStep(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  const [ed] = await db.select().from(t.eightDs).where(eq(t.eightDs.id, id));
  if (!ed || ed.projectId !== projectId) return { error: "8D not found." };
  const stepNum = Math.min(Math.max(num(fd, "step") ?? 1, 1), 8);
  const text = s(fd, "text");
  if (!text) return { error: "Write up this discipline before saving it." };
  const disciplines = { ...(ed.disciplines as Record<string, string>), [`d${stepNum}`]: text };
  const advance = s(fd, "advance") === "1";
  const nextStep = advance ? Math.min(stepNum + 1, 8) : ed.currentStep;
  const done = advance && stepNum === 8;
  await db.update(t.eightDs).set({
    disciplines, currentStep: done ? 8 : Math.max(nextStep, ed.currentStep),
    status: done ? "closed" : ed.status, updatedAt: new Date(),
  }).where(eq(t.eightDs.id, id));
  revalidatePath(`/p/${projectId}/8d/${id}`);
  return { ok: true, message: done ? "D8 saved — 8D closed. Congratulate the team!" : advance ? `D${stepNum} saved — on to D${nextStep}.` : `D${stepNum} updated.` };
}

// ---------- Part I: Audit checklist ----------
export async function createAudit(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const [run] = await db.insert(t.auditRuns).values({
    projectId, name, standard: s(fd, "standard") || "IATF 16949",
  }).returning();
  redirect(`/p/${projectId}/audit/${run.id}`);
}

export async function saveAuditResponses(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  const [run] = await db.select().from(t.auditRuns).where(eq(t.auditRuns.id, id));
  if (!run || run.projectId !== projectId) return { error: "Audit not found." };
  const responses: Record<string, { result: string; note?: string }> = {};
  for (const [k, v] of fd.entries()) {
    const m = /^result_(q\d+)$/.exec(k);
    if (m && ["pass", "fail", "na"].includes(String(v)))
      responses[m[1]] = { result: String(v), note: s(fd, `note_${m[1]}`) || undefined };
  }
  await db.update(t.auditRuns).set({ responses, updatedAt: new Date() }).where(eq(t.auditRuns.id, id));
  revalidatePath(`/p/${projectId}/audit/${id}`);
  return { ok: true, message: "Audit responses saved." };
}

/** Part I — turn a failed audit question into a CAPA action item (draft). */
export async function capaFromAuditItem(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const title = s(fd, "title");
  if (!title) return { error: "Missing item." };
  await db.insert(t.capas).values({ projectId, title, source: "manual", status: "draft" });
  revalidatePath(`/p/${projectId}/capa`);
  return { ok: true, message: "Draft CAPA created from the failed item — review it in the CAPA register." };
}

// ---------- Part J: Capacity ----------
export async function createCapacityStudy(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };

  // Part J option — reuse a Line Balancing study's stations as process steps.
  const fromLb = s(fd, "fromLineBalance");
  let steps: { name: string; cycleTime: number; availableTime: number }[] = [];
  let sourceLineBalanceId: string | null = null;
  if (fromLb) {
    const [lb] = await db.select().from(t.lineBalances).where(eq(t.lineBalances.id, fromLb));
    if (lb && lb.projectId === projectId) {
      steps = (lb.stations as any[]).map(st => ({
        name: st.name, cycleTime: Number(st.cycleTime), availableTime: lb.availableTime,
      }));
      sourceLineBalanceId = lb.id;
    }
  } else {
    steps = json<{ name: string; cycleTime: number; availableTime: number }[]>(fd, "rows", [])
      .map(r => ({ name: String(r.name ?? "").trim(), cycleTime: Number(r.cycleTime), availableTime: Number(r.availableTime) }))
      .filter(r => r.name && r.cycleTime > 0 && r.availableTime > 0);
  }
  if (!steps.length) return { error: "Add at least one step (or pick a line-balance study to reuse)." };
  const [cs] = await db.insert(t.capacityStudies).values({ projectId, name, steps, sourceLineBalanceId }).returning();
  redirect(`/p/${projectId}/capacity/${cs.id}`);
}

// ---------- Part K: Inventory ----------
export async function addSku(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  const annualDemand = num(fd, "annualDemand"), orderCost = num(fd, "orderCost"), holdingCost = num(fd, "holdingCost");
  const unitCost = num(fd, "unitCost") ?? 0;
  if (!name || annualDemand == null || orderCost == null || holdingCost == null
    || annualDemand <= 0 || orderCost <= 0 || holdingCost <= 0 || unitCost < 0)
    return { error: "Name plus positive annual demand, order cost, and holding cost are required." };
  await db.insert(t.skus).values({ projectId, name, annualDemand, orderCost, holdingCost, unitCost });
  revalidatePath(`/p/${projectId}/inventory`);
  return { ok: true, message: "SKU added." };
}

export async function deleteSku(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  await db.delete(t.skus).where(and(eq(t.skus.id, id), eq(t.skus.projectId, projectId)));
  revalidatePath(`/p/${projectId}/inventory`);
  return { ok: true, message: "SKU removed." };
}

// ---------- Part L: Gantt / CPM ----------
export async function createCpmPlan(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const tasks: CpmTask[] = json<any[]>(fd, "rows", [])
    .map((r, i) => ({
      key: String(r.key ?? "").trim() || `T${i + 1}`,
      name: String(r.name ?? "").trim(),
      duration: Number(r.duration),
      preds: String(r.preds ?? "").split(/[,\s]+/).map(x => x.trim()).filter(Boolean),
    }))
    .filter(r => r.name && !isNaN(r.duration) && r.duration > 0);
  if (!tasks.length) return { error: "Add at least one task with a positive duration." };
  const keys = new Set(tasks.map(x => x.key));
  if (keys.size !== tasks.length) return { error: "Task IDs must be unique." };
  const solved = cpm(tasks);
  if (!solved.ok) return { error: solved.error };
  const [plan] = await db.insert(t.cpmPlans).values({ projectId, name, tasks }).returning();
  redirect(`/p/${projectId}/gantt/${plan.id}`);
}

// ---------- Part N: quick action — draft a CAPA straight from an alert ----------
export async function capaFromAlert(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), alertId = s(fd, "alertId");
  await requireProjectAccess(projectId);
  const [alert] = await db.select().from(t.alerts).where(and(
    eq(t.alerts.id, alertId), eq(t.alerts.projectId, projectId)));
  if (!alert) return { error: "Alert not found." };
  await db.insert(t.capas).values({
    projectId, source: "manual", status: "draft",
    title: `[From alert ${alert.ruleCode}] ${alert.message.slice(0, 180)}`,
  });
  revalidatePath(`/p/${projectId}/capa`);
  revalidatePath(`/p/${projectId}`);
  return { ok: true, message: "Draft CAPA created from this alert — review it in the CAPA register." };
}

// ---------- Part O: multi-industry demo seeds ----------
export async function seedSemiconductorProject(_prev: any, _fd: FormData) {
  const uid = await getSessionUserId();
  if (!uid) redirect("/login");
  let projectId: string;
  try {
    ({ projectId } = await seedSemiconductorDemo(uid!, { advancePlaybook, upsertFmeaItem, setAlertStatus }));
  } catch (e) {
    console.error("seedSemiconductorProject failed", e);
    return { error: "Couldn't create the example project. Please try again." };
  }
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/p/${projectId}`);
}

export async function seedLogisticsProject(_prev: any, _fd: FormData) {
  const uid = await getSessionUserId();
  if (!uid) redirect("/login");
  let projectId: string;
  try {
    ({ projectId } = await seedLogisticsDemo(uid!, { advancePlaybook, upsertFmeaItem, setAlertStatus }));
  } catch (e) {
    console.error("seedLogisticsProject failed", e);
    return { error: "Couldn't create the example project. Please try again." };
  }
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/p/${projectId}`);
}

// ---------- Part P: guided-flow step advance ----------
// Mirrors advancePlaybook exactly for validation and decision-gate logging
// (same decisions insert shape), and ADDITIVELY stores in run.state[stepKey]:
// intake answers, the ranked recommendations shown, which tool was recommended
// vs. chosen, and the chosen tool's real output pulled from live data.
export async function advanceGuidedStep(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), runId = s(fd, "runId");
  await requireProjectAccess(projectId);
  const [run] = await db.select().from(t.playbookRuns).where(eq(t.playbookRuns.id, runId));
  if (!run || run.status !== "active") return { error: "This playbook run is not active." };
  const pb = PLAYBOOKS[run.playbookKey];
  const step = pb.steps[run.stepIndex];
  const state: any = { ...(run.state as any) };
  const stepState: any = {};

  // 1. The step's original free-text inputs — same required-field rule as advancePlaybook.
  for (const input of step.inputs ?? []) {
    const v = s(fd, input.key);
    if (!v) return { error: `"${input.label}" is required before moving on.` };
    stepState[input.key] = v;
  }

  // 2. Intake answers (multiple choice, defined in lib/guided.ts).
  const intakeQs = GUIDED_INTAKE[run.playbookKey]?.[step.key] ?? [];
  if (intakeQs.length) {
    const intake: Record<string, string> = {};
    for (const q of intakeQs) {
      const v = s(fd, `intake_${q.key}`);
      if (!v) return { error: `Answer "${q.question}" before moving on.` };
      intake[q.key] = v;
    }
    stepState.intake = intake;

    // 3. Ranked shortlist steps: record what was recommended vs. chosen, log it
    // in the decision log (app suggests / team decides), and pull the chosen
    // tool's REAL output from live project data — no re-entry.
    if (SHORTLIST_STEPS.includes(step.key)) {
      const recs = recommendTools(step.key, intake);
      const chosenTool = s(fd, "chosen_tool") as ToolKey | "";
      stepState.recommendations = recs.map(r => ({
        tool: r.tool, label: TOOL_META[r.tool].label, score: r.score, reason: r.reasons[0],
      }));
      stepState.recommendedTool = recs[0]?.tool ?? null;
      stepState.chosenTool = chosenTool || null;
      if (chosenTool && TOOL_META[chosenTool]) {
        await db.insert(t.decisions).values({
          projectId, runId, gateKey: `${step.key}_tool`,
          question: `Which tool should the team use for the ${step.phase} step?`,
          suggested: recs.map(r => ({ value: r.tool, label: TOOL_META[r.tool].label, rationale: r.reasons.join(" ") })),
          chosen: TOOL_META[chosenTool].label,
          rationale: chosenTool === (recs[0]?.tool ?? "") ? "Followed the top recommendation." : "Team chose differently from the top recommendation.",
          decidedBy: s(fd, "gate_decidedBy") || null,
        });
        stepState.toolResult = await latestToolResult(projectId, chosenTool);
      }
    }
  }

  // 4. Decision gate — identical logic and insert shape to advancePlaybook.
  if (step.gate) {
    const chosen = s(fd, "gate_choice");
    const rationale = s(fd, "gate_rationale");
    const decidedBy = s(fd, "gate_decidedBy");
    if (!chosen) return { error: "Record the team's decision before moving on — the app suggests, your team decides." };
    await db.insert(t.decisions).values({
      projectId, runId, gateKey: step.gate.key, question: step.gate.question,
      suggested: step.gate.options, chosen, rationale: rationale || null, decidedBy: decidedBy || null,
    });
    stepState.decision = chosen;
  }

  state[step.key] = stepState;
  const nextIndex = run.stepIndex + 1;
  const done = nextIndex >= pb.steps.length;
  await db.update(t.playbookRuns).set({
    state, stepIndex: done ? run.stepIndex : nextIndex,
    status: done ? "completed" : "active", updatedAt: new Date(),
  }).where(eq(t.playbookRuns.id, runId));
  revalidatePath(`/p/${projectId}/playbooks/${runId}`);
  return { ok: true, message: done ? "Playbook completed — the decision log is saved on this project." : "Step saved." };
}
