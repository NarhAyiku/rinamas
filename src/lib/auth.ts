import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
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

export function makeSessionToken(staffId: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${staffId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = sign(`${id}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) <= Math.floor(Date.now() / 1000)) return null;
  return id;
}

/** Current signed-in staff member, or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const id = readSessionToken(store.get(COOKIE)?.value);
  if (!id) return null;
  const s = await prisma.staff.findUnique({ where: { id } });
  if (!s || !s.active) return null;
  return { id: s.id, username: s.username, name: s.name, role: s.role as Role };
});

export async function setSessionCookie(staffId: string) {
  const store = await cookies();
  store.set(COOKIE, makeSessionToken(staffId), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}
