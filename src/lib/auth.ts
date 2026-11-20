import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";

const COOKIE = "rinamas_staff";
const TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type Role = "admin" | "superadmin";
export type Session = { id: string; username: string; name: string; role: Role };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set to at least 16 characters");
  return s;
}
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Cookie value: staffId.sessionVersion.expiry.signature. Bumping Staff.sessionVersion invalidates every older cookie. */
export function makeSessionToken(staffId: string, version: number) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${staffId}.${version}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): { id: string; version: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, ver, exp, sig] = parts;
  const expected = sign(`${id}.${ver}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) <= Math.floor(Date.now() / 1000)) return null;
  const version = Number(ver);
  if (!Number.isInteger(version)) return null;
  return { id, version };
}

/** Current signed-in staff member, or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const tok = readSessionToken(store.get(COOKIE)?.value);
  if (!tok) return null;
  const s = await prisma.staff.findUnique({ where: { id: tok.id } });
  if (!s || !s.active || s.sessionVersion !== tok.version) return null;
  return { id: s.id, username: s.username, name: s.name, role: s.role as Role };
});

export async function setSessionCookie(staffId: string, version: number) {
  const store = await cookies();
  store.set(COOKIE, makeSessionToken(staffId, version), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_SECONDS,
  });
}

/** Signs this account out everywhere: every cookie issued before now stops working. Returns the new version. */
export async function bumpSessionVersion(staffId: string) {
  const s = await prisma.staff.update({ where: { id: staffId }, data: { sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  return s.sessionVersion;
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Signed-in staff member or a redirect to the login page. Use in server actions and pages. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}

/** Super admin or a redirect back to the desk with a notice. */
export async function requireSuper(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== "superadmin") redirect("/admin?denied=1");
  return s;
}
