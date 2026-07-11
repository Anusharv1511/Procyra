import { db, t } from "@/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getSessionUserId } from "./auth";

export async function myWorkspaces() {
  const uid = await getSessionUserId();
  if (!uid) return [];
  const rows = await db
    .select({ ws: t.workspaces })
    .from(t.memberships)
    .innerJoin(t.workspaces, eq(t.workspaces.id, t.memberships.workspaceId))
    .where(eq(t.memberships.userId, uid));
  return rows.map(r => r.ws);
}

export async function myProjects() {
  const wss = await myWorkspaces();
  if (!wss.length) return [];
  const ps = await db.select().from(t.projects)
    .where(inArray(t.projects.workspaceId, wss.map(w => w.id)))
    .orderBy(desc(t.projects.createdAt));
  return ps.map(p => ({ ...p, workspace: wss.find(w => w.id === p.workspaceId)! }));
}

/** Project + its workspace, only if the session user is a member. */
export async function getProject(projectId: string) {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const rows = await db
    .select({ p: t.projects, ws: t.workspaces })
    .from(t.projects)
    .innerJoin(t.workspaces, eq(t.workspaces.id, t.projects.workspaceId))
    .innerJoin(t.memberships, and(
      eq(t.memberships.workspaceId, t.workspaces.id),
      eq(t.memberships.userId, uid),
    ))
    .where(eq(t.projects.id, projectId));
  if (!rows.length) return null;
  return { ...rows[0].p, workspace: rows[0].ws };
}

export async function openAlerts(projectIds: string[], limit = 50) {
  if (!projectIds.length) return [];
  return db.select().from(t.alerts)
    .where(and(inArray(t.alerts.projectId, projectIds), eq(t.alerts.status, "open")))
    .orderBy(desc(t.alerts.createdAt)).limit(limit);
}

export async function dueTasks(projectIds: string[]) {
  if (!projectIds.length) return [];
  const all = await db.select().from(t.scheduledTasks)
    .where(inArray(t.scheduledTasks.projectId, projectIds));
  const soon = Date.now() + 3 * 24 * 3600 * 1000;
  return all
    .filter(x => new Date(x.nextDue).getTime() <= soon)
    .sort((a, b) => +new Date(a.nextDue) - +new Date(b.nextDue));
}
