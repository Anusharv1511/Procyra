"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, t } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  hashPassword, verifyPassword, createSession, destroySession,
  getSessionUserId, requireProjectAccess,
} from "@/lib/auth";
import { runSpcRules, runOeeRules, runNcRules, runFmeaRules } from "@/lib/rules";
import { PLAYBOOKS } from "@/lib/playbooks";

// ---------- helpers ----------
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v === "" ? null : Number(v);
};

async function industryOf(projectId: string) {
  const rows = await db.select({ industry: t.workspaces.industry })
    .from(t.projects)
    .innerJoin(t.workspaces, eq(t.workspaces.id, t.projects.workspaceId))
    .where(eq(t.projects.id, projectId));
  return rows[0]?.industry ?? "general";
}

// ---------- auth ----------
export async function register(_prev: any, fd: FormData) {
  const name = s(fd, "name"), email = s(fd, "email").toLowerCase(), password = s(fd, "password");
  if (!name || !email || password.length < 8)
    return { error: "Name, email, and a password of at least 8 characters are required." };
  const existing = await db.select().from(t.users).where(eq(t.users.email, email));
  if (existing.length) return { error: "An account with this email already exists." };
  const [user] = await db.insert(t.users).values({
    name, email, passwordHash: await hashPassword(password),
  }).returning();
  await createSession(user.id);
  redirect("/setup");
}

export async function login(_prev: any, fd: FormData) {
  const email = s(fd, "email").toLowerCase(), password = s(fd, "password");
  const [user] = await db.select().from(t.users).where(eq(t.users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return { error: "Email or password is incorrect." };
  await createSession(user.id);
  const ms = await db.select().from(t.memberships).where(eq(t.memberships.userId, user.id));
  redirect(ms.length ? "/dashboard" : "/setup");
}

export async function logout() {
  destroySession();
  redirect("/login");
}

// ---------- setup / workspaces / projects ----------
export async function createWorkspace(_prev: any, fd: FormData) {
  const uid = await getSessionUserId();
  if (!uid) redirect("/login");
  const name = s(fd, "name"), industry = s(fd, "industry"), processType = s(fd, "processType");
  const projectName = s(fd, "projectName");
  if (!name || !projectName) return { error: "Workspace and first project names are required." };
  const [ws] = await db.insert(t.workspaces).values({ name, industry, processType }).returning();
  await db.insert(t.memberships).values({ userId: uid!, workspaceId: ws.id, role: "owner" });
  await db.insert(t.projects).values({ workspaceId: ws.id, name: projectName });
  redirect("/dashboard");
}

export async function createProject(_prev: any, fd: FormData) {
  const uid = await getSessionUserId();
  if (!uid) redirect("/login");
  const workspaceId = s(fd, "workspaceId"), name = s(fd, "name");
  const member = await db.select().from(t.memberships).where(and(
    eq(t.memberships.userId, uid!), eq(t.memberships.workspaceId, workspaceId)));
  if (!member.length) return { error: "You don't have access to that workspace." };
  if (!name) return { error: "Project name is required." };
  const [p] = await db.insert(t.projects).values({ workspaceId, name, description: s(fd, "description") || null }).returning();
  redirect(`/p/${p.id}`);
}

// ---------- streams & data points ----------
export async function createStream(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const type = s(fd, "type");
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const [stream] = await db.insert(t.streams).values({
    projectId, name, type,
    unit: s(fd, "unit") || null,
    subgroupSize: type === "SPC_XBAR_R" ? Math.min(Math.max(num(fd, "subgroupSize") ?? 5, 2), 10) : 1,
    specLow: num(fd, "specLow"), specHigh: num(fd, "specHigh"),
    target: num(fd, "target"),
    cpkThreshold: num(fd, "cpkThreshold") ?? 1.33,
  }).returning();
  const base = type === "OEE" ? "oee" : "spc";
  redirect(`/p/${projectId}/${base}/${stream.id}`);
}

export async function addSpcPoint(_prev: any, fd: FormData) {
  const streamId = s(fd, "streamId"), projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const [stream] = await db.select().from(t.streams).where(eq(t.streams.id, streamId));
  if (!stream) return { error: "Stream not found." };
  const raw = s(fd, "values");
  const values = raw.split(/[,\s]+/).filter(Boolean).map(Number);
  if (values.some(isNaN)) return { error: "Measurements must be numbers separated by commas or spaces." };
  const need = stream.type === "SPC_XBAR_R" ? stream.subgroupSize : 1;
  if (values.length !== need)
    return { error: `This stream expects exactly ${need} measurement${need > 1 ? "s" : ""} per entry.` };
  const [pt] = await db.insert(t.dataPoints).values({ streamId, payload: { values } }).returning();
  const flags = await runSpcRules(streamId, pt.id); // rules run automatically on entry
  revalidatePath(`/p/${projectId}/spc/${streamId}`);
  return {
    ok: true,
    flagged: flags.length > 0,
    message: flags.length
      ? `Point logged — OUT OF CONTROL: ${flags.map(f => f.rule).join(", ")}. Alert raised.`
      : "Point logged — in control.",
  };
}

export async function addOeePoint(_prev: any, fd: FormData) {
  const streamId = s(fd, "streamId"), projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const payload = {
    planned: num(fd, "planned"), runtime: num(fd, "runtime"),
    idealCycle: num(fd, "idealCycle"), total: num(fd, "total"), good: num(fd, "good"),
  };
  if (Object.values(payload).some(v => v == null || isNaN(v) || v < 0))
    return { error: "All five values are required and must be non-negative numbers." };
  if (payload.runtime! > payload.planned!) return { error: "Run time cannot exceed planned time." };
  if (payload.good! > payload.total!) return { error: "Good count cannot exceed total count." };
  const [pt] = await db.insert(t.dataPoints).values({ streamId, payload }).returning();
  const c = await runOeeRules(streamId, pt.id);
  revalidatePath(`/p/${projectId}/oee/${streamId}`);
  return { ok: true, message: c ? `Logged — OEE ${(c.oee * 100).toFixed(1)}%` : "Logged." };
}

// ---------- non-conformances ----------
export async function addNc(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const defectCode = s(fd, "defectCode"), processArea = s(fd, "processArea");
  const qty = num(fd, "qty") ?? 1;
  if (!defectCode || !processArea) return { error: "Code and process area are required." };
  const [nc] = await db.insert(t.nonConformances).values({
    projectId, defectCode, processArea, qty: Math.max(1, Math.round(qty)),
    severity: s(fd, "severity") || "minor",
    description: s(fd, "description") || null,
  }).returning();
  const industry = await industryOf(projectId);
  const res = await runNcRules(projectId, nc.id, industry); // auto-draft CAPA on repeat
  revalidatePath(`/p/${projectId}/nc`);
  return {
    ok: true,
    message: res.autoCapa
      ? `Logged. This ${defectCode.toUpperCase()} has now recurred ${res.count}x — a draft CAPA was created for your review.`
      : "Logged.",
  };
}

// ---------- CAPA ----------
export async function createCapa(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const title = s(fd, "title");
  if (!title) return { error: "Title is required." };
  await db.insert(t.capas).values({
    projectId, title, owner: s(fd, "owner") || null,
    linkedDefectCode: s(fd, "linkedDefectCode") || null,
    dueDate: s(fd, "dueDate") ? new Date(s(fd, "dueDate")) : null,
  });
  revalidatePath(`/p/${projectId}/capa`);
  return { ok: true, message: "CAPA created." };
}

export async function updateCapa(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  await db.update(t.capas).set({
    status: s(fd, "status"),
    owner: s(fd, "owner") || null,
    rootCause: s(fd, "rootCause") || null,
    correctiveAction: s(fd, "correctiveAction") || null,
    preventiveAction: s(fd, "preventiveAction") || null,
    updatedAt: new Date(),
  }).where(and(eq(t.capas.id, id), eq(t.capas.projectId, projectId)));
  revalidatePath(`/p/${projectId}/capa`);
  return { ok: true, message: "CAPA updated." };
}

// ---------- FMEA ----------
export async function createFmea(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const [f] = await db.insert(t.fmeas).values({
    projectId, name, type: s(fd, "type") || "PFMEA",
    rpnAction: num(fd, "rpnAction") ?? 100,
  }).returning();
  redirect(`/p/${projectId}/fmea/${f.id}`);
}

export async function upsertFmeaItem(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), fmeaId = s(fd, "fmeaId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  const clamp = (v: number | null) => Math.min(Math.max(Math.round(v ?? 1), 1), 10);
  const vals = {
    processStep: s(fd, "processStep"), failureMode: s(fd, "failureMode"),
    effect: s(fd, "effect") || null, cause: s(fd, "cause") || null,
    severity: clamp(num(fd, "severity")), occurrence: clamp(num(fd, "occurrence")), detection: clamp(num(fd, "detection")),
    recommendedAction: s(fd, "recommendedAction") || null,
    actionStatus: s(fd, "actionStatus") || "none",
    linkedDefectCode: s(fd, "linkedDefectCode") || null,
  };
  if (!vals.processStep || !vals.failureMode) return { error: "Process step and failure mode are required." };
  let itemId = id;
  if (id) {
    await db.update(t.fmeaItems).set(vals).where(eq(t.fmeaItems.id, id));
  } else {
    const [item] = await db.insert(t.fmeaItems).values({ ...vals, fmeaId }).returning();
    itemId = item.id;
  }
  const rpn = await runFmeaRules(fmeaId, itemId); // RPN recomputed + threshold alert, register re-sorts on render
  revalidatePath(`/p/${projectId}/fmea/${fmeaId}`);
  return { ok: true, message: `Saved — RPN ${rpn}.` };
}

// ---------- time study ----------
export async function createTimeStudy(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const [study] = await db.insert(t.timeStudies).values({
    projectId, name,
    personalPct: num(fd, "personalPct") ?? 5,
    fatiguePct: num(fd, "fatiguePct") ?? 4,
    delayPct: num(fd, "delayPct") ?? 3,
    learningCurvePct: num(fd, "learningCurvePct") ?? 90,
  }).returning();
  redirect(`/p/${projectId}/timestudy/${study.id}`);
}

export async function addTimeStudyElement(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), studyId = s(fd, "studyId");
  await requireProjectAccess(projectId);
  const description = s(fd, "description");
  const observations = s(fd, "observations").split(/[,\s]+/).filter(Boolean).map(Number);
  const rating = num(fd, "rating") ?? 100;
  if (!description || observations.length === 0 || observations.some(x => isNaN(x) || x <= 0))
    return { error: "Description and at least one positive observed time are required." };
  const existing = await db.select().from(t.timeStudyElements).where(eq(t.timeStudyElements.studyId, studyId));
  await db.insert(t.timeStudyElements).values({
    studyId, seq: existing.length + 1, description, observations, rating,
  });
  revalidatePath(`/p/${projectId}/timestudy/${studyId}`);
  return { ok: true, message: "Element added." };
}

// ---------- scheduler ----------
export async function createTask(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId");
  await requireProjectAccess(projectId);
  const title = s(fd, "title"), recurrence = s(fd, "recurrence"), nextDue = s(fd, "nextDue");
  if (!title || !nextDue) return { error: "Title and first due date are required." };
  await db.insert(t.scheduledTasks).values({
    projectId, title, recurrence,
    nextDue: new Date(nextDue + "T12:00:00"),
    notes: s(fd, "notes") || null, assignee: s(fd, "assignee") || null,
  });
  revalidatePath(`/p/${projectId}/tasks`);
  return { ok: true, message: "Recurring task scheduled." };
}

export async function completeTask(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id");
  await requireProjectAccess(projectId);
  const [task] = await db.select().from(t.scheduledTasks).where(eq(t.scheduledTasks.id, id));
  if (!task) return { error: "Task not found." };
  const d = new Date(task.nextDue);
  if (task.recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (task.recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (task.recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setMonth(d.getMonth() + 3);
  await db.update(t.scheduledTasks).set({ lastCompleted: new Date(), nextDue: d })
    .where(eq(t.scheduledTasks.id, id));
  revalidatePath(`/p/${projectId}/tasks`);
  return { ok: true, message: `Done — next occurrence ${d.toLocaleDateString()}.` };
}

// ---------- alerts ----------
export async function setAlertStatus(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), id = s(fd, "id"), status = s(fd, "status");
  await requireProjectAccess(projectId);
  await db.update(t.alerts).set({
    status,
    acknowledgedAt: status === "acknowledged" ? new Date() : undefined,
    resolvedAt: status === "resolved" ? new Date() : undefined,
  }).where(and(eq(t.alerts.id, id), eq(t.alerts.projectId, projectId)));
  revalidatePath(`/p/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: status === "resolved" ? "Alert resolved." : "Alert acknowledged." };
}

// ---------- playbooks (Guided Mode) ----------
export async function startPlaybook(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), key = s(fd, "key");
  await requireProjectAccess(projectId);
  if (!PLAYBOOKS[key]) return { error: "Unknown playbook." };
  const [run] = await db.insert(t.playbookRuns).values({ projectId, playbookKey: key }).returning();
  redirect(`/p/${projectId}/playbooks/${run.id}`);
}

export async function advancePlaybook(_prev: any, fd: FormData) {
  const projectId = s(fd, "projectId"), runId = s(fd, "runId");
  await requireProjectAccess(projectId);
  const [run] = await db.select().from(t.playbookRuns).where(eq(t.playbookRuns.id, runId));
  if (!run || run.status !== "active") return { error: "This playbook run is not active." };
  const pb = PLAYBOOKS[run.playbookKey];
  const step = pb.steps[run.stepIndex];
  const state: any = { ...(run.state as any) };
  const stepState: any = {};

  for (const input of step.inputs ?? []) {
    const v = s(fd, input.key);
    if (!v) return { error: `"${input.label}" is required before moving on.` };
    stepState[input.key] = v;
  }

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
