import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
const COOKIE = "procyra_session";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const rows = await db.select().from(t.users).where(eq(t.users.id, uid)).limit(1);
  return rows[0] ?? null;
}

/** Throws if the current user has no membership over the project's workspace. */
export async function requireProjectAccess(projectId: string) {
  const uid = await getSessionUserId();
  if (!uid) throw new Error("unauthenticated");
  const rows = await db
    .select({ projectId: t.projects.id, workspaceId: t.projects.workspaceId })
    .from(t.projects)
    .innerJoin(t.memberships, eq(t.memberships.workspaceId, t.projects.workspaceId))
    .where(eq(t.projects.id, projectId));
  const ok = rows.length > 0 && (await db.select().from(t.memberships)
    .where(eq(t.memberships.userId, uid))).some(m => m.workspaceId === rows[0].workspaceId);
  if (!ok) throw new Error("forbidden");
  return { userId: uid, workspaceId: rows[0].workspaceId };
}
