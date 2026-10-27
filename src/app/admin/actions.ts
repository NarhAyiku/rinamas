"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearSessionCookie, getSession, requireSession, requireSuper, setSessionCookie, type Session } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logActivity } from "@/lib/activity";
import { ALL_STATUSES, STATUS_LABEL, ghs } from "@/lib/format";
import { storePhoto } from "@/lib/upload";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => { const v = str(fd, k); return v === "" ? null : Number(v); };

/* ---------- auth ---------- */
export async function login(_prev: { error?: string } | undefined, fd: FormData) {
  const username = str(fd, "username").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const staff = await prisma.staff.findUnique({ where: { username } });
  const ok = staff && staff.active && verifyPassword(password, staff.passwordHash);
  if (!ok) {
    // keep timing similar whether or not the user exists
    if (!staff) verifyPassword(password, "scrypt$00$00");
    return { error: "Wrong username or password." };
  }
  await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(staff.id);
  await logActivity({ id: staff.id, username: staff.username, name: staff.name, role: staff.role as Session["role"] }, "auth.login", `${staff.name} signed in`);
  redirect("/admin");
}

export async function logout() {
  const s = await getSession();
  if (s) await logActivity(s, "auth.logout", `${s.name} signed out`);
  await clearSessionCookie();
  redirect("/admin/login");
}

/* ---------- quote requests ---------- */
export async function updateQuote(fd: FormData) {
  const s = await requireSession();
  const id = str(fd, "id");
  const status = str(fd, "status");
  const adminNote = str(fd, "adminNote") || null;
  if (!(ALL_STATUSES as readonly string[]).includes(status)) return;
  const before = await prisma.quoteRequest.findUnique({ where: { id } });
  if (!before) return;
  await prisma.quoteRequest.update({ where: { id }, data: { status, adminNote } });
  const changes: string[] = [];
  if (before.status !== status) changes.push(`status ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[status]}`);
  if ((before.adminNote ?? "") !== (adminNote ?? "")) changes.push(adminNote ? `note "${adminNote}"` : "note cleared");
  if (changes.length) await logActivity(s, "quote.update", `${before.reference}: ${changes.join(", ")}`, { type: "quote", id });
  revalidatePath("/admin"); revalidatePath(`/admin/requests/${id}`); revalidatePath(`/quote/${id}`);
}

const hireSchema = z.object({
  quotedAmount: z.number().int().min(0).nullable(),
  depositAmount: z.number().int().min(0).nullable(),
  depositPaidAt: z.string().max(10).nullable(),
  depositMethod: z.enum(["momo", "bank", "cash", "cheque"]).nullable(),
  siteAgentName: z.string().max(80).nullable(),
  siteAgentPhone: z.string().max(30).nullable(),
  dispatchDate: z.string().max(10).nullable(),
  dispatchMeter: z.number().int().min(0).nullable(),
  dispatchNotes: z.string().max(2000).nullable(),
  returnDate: z.string().max(10).nullable(),
  returnMeter: z.number().int().min(0).nullable(),
  returnNotes: z.string().max(2000).nullable(),
});

export async function saveHire(fd: FormData) {
  const s = await requireSession();
  const id = str(fd, "id");
  const parsed = hireSchema.safeParse({
    quotedAmount: num(fd, "quotedAmount"), depositAmount: num(fd, "depositAmount"),
    depositPaidAt: str(fd, "depositPaidAt") || null, depositMethod: str(fd, "depositMethod") || null,
    siteAgentName: str(fd, "siteAgentName") || null, siteAgentPhone: str(fd, "siteAgentPhone") || null,
    dispatchDate: str(fd, "dispatchDate") || null, dispatchMeter: num(fd, "dispatchMeter"), dispatchNotes: str(fd, "dispatchNotes") || null,
    returnDate: str(fd, "returnDate") || null, returnMeter: num(fd, "returnMeter"), returnNotes: str(fd, "returnNotes") || null,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the hire details");
  const before = await prisma.quoteRequest.findUnique({ where: { id } });
  if (!before) return;
  const d = parsed.data;
  await prisma.quoteRequest.update({ where: { id }, data: d });
  const diffs: string[] = [];
  const label: Record<string, string> = { quotedAmount: "quote", depositAmount: "deposit", depositPaidAt: "deposit date", depositMethod: "deposit method", siteAgentName: "site agent", siteAgentPhone: "site agent phone", dispatchDate: "dispatch date", dispatchMeter: "dispatch meter", dispatchNotes: "dispatch condition", returnDate: "return date", returnMeter: "return meter", returnNotes: "return condition" };
  for (const k of Object.keys(d) as (keyof typeof d)[]) {
    const a = before[k] ?? null, b = d[k] ?? null;
    if (String(a ?? "") !== String(b ?? "")) diffs.push(`${label[k]} → ${typeof b === "number" && (k === "quotedAmount" || k === "depositAmount") ? ghs(b) : (b ?? "cleared")}`);
  }
  if (diffs.length) await logActivity(s, "quote.hire", `${before.reference}: ${diffs.join("; ")}`, { type: "quote", id });
  revalidatePath(`/admin/requests/${id}`); revalidatePath(`/quote/${id}`); revalidatePath("/admin");
}

export async function addHourLog(fd: FormData) {
  const s = await requireSession();
  const quoteId = str(fd, "quoteId");
  const date = str(fd, "date");
  const hours = Number(str(fd, "hours") || 0), standby = Number(str(fd, "standby") || 0), fuelL = Number(str(fd, "fuelL") || 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || [hours, standby, fuelL].some((n) => Number.isNaN(n) || n < 0 || n > 24 * 10)) return;
  const q = await prisma.quoteRequest.findUnique({ where: { id: quoteId } });
  if (!q) return;
  await prisma.hourLog.create({ data: { quoteId, date, hours, standby, fuelL, note: str(fd, "note") || null, loggedBy: s.name } });
  await logActivity(s, "hourlog.add", `${q.reference}: ${date} ${hours} h worked, ${standby} h standby, ${fuelL} L fuel`, { type: "quote", id: quoteId });
  revalidatePath(`/admin/requests/${quoteId}`); revalidatePath(`/quote/${quoteId}`);
}

export async function deleteHourLog(fd: FormData) {
  const s = await requireSession();
  const id = str(fd, "id");
  const log = await prisma.hourLog.findUnique({ where: { id }, include: { quote: true } });
  if (!log) return;
  await prisma.hourLog.delete({ where: { id } });
  await logActivity(s, "hourlog.delete", `${log.quote.reference}: removed log for ${log.date}`, { type: "quote", id: log.quoteId });
  revalidatePath(`/admin/requests/${log.quoteId}`);
}

/* ---------- fleet ---------- */
const machineSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "slug: lowercase letters, numbers, dashes"),
  name: z.string().trim().min(2),
  category: z.enum(["earth", "haul", "road", "lift"]),
  categoryLabel: z.string().trim().min(2),
  image: z.string().trim(),
  specs: z.string().trim(),
  dayRate: z.coerce.number().int().min(0),
  rateUnit: z.enum(["day", "trip"]),
  operatorRate: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  available: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
});

export type MachineFormState = { error?: string; ok?: string } | undefined;

export async function saveMachine(_prev: MachineFormState, fd: FormData): Promise<MachineFormState> {
  const s = await requireSession();
  const photo = fd.get("photo");
  fd.delete("photo");
  const raw = Object.fromEntries(fd.entries());
  const specs = String(raw.specs ?? "").split("\n").map((l) => l.split(":")).filter((p) => p.length >= 2)
    .map(([k, ...v]) => [k.trim(), v.join(":").trim()]);
  const parsed = machineSchema.safeParse({ ...raw, specs: JSON.stringify(specs), available: raw.available === "on" });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${i?.path?.[0] ? String(i.path[0]) + ": " : ""}${i?.message ?? "Check the machine details."}` };
  }
  const { id, operatorRate, ...rest } = parsed.data;
  const data = { ...rest, operatorRate: operatorRate === "" ? null : operatorRate };
  try {
    if (photo instanceof File && photo.size > 0) data.image = await storePhoto(photo, data.slug);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("machine photo upload failed", { slug: data.slug, size: photo instanceof File ? photo.size : 0, type: photo instanceof File ? photo.type : "", msg });
    return { error: `Photo upload failed: ${msg}` };
  }
  if (!data.image || data.image === "/img/") return { error: "Upload a photo or give an image path." };
  try {
    if (id) {
      const before = await prisma.machine.findUnique({ where: { id } });
      await prisma.machine.update({ where: { id }, data });
      const diffs: string[] = [];
      if (before && before.dayRate !== data.dayRate) diffs.push(`rate ${ghs(before.dayRate)} → ${ghs(data.dayRate)}`);
      if (before && before.name !== data.name) diffs.push(`renamed from "${before.name}"`);
      if (before && before.available !== data.available) diffs.push(data.available ? "marked available" : "marked on hire");
      if (before && before.image !== data.image) diffs.push("photo replaced");
      await logActivity(s, "machine.save", `${data.name}: ${diffs.length ? diffs.join(", ") : "details edited"}`, { type: "machine", id });
    } else {
      if (await prisma.machine.findUnique({ where: { slug: data.slug } })) return { error: `A machine with the slug "${data.slug}" already exists. Pick another slug.` };
      const m = await prisma.machine.create({ data });
      await logActivity(s, "machine.create", `Added ${m.name} at ${ghs(m.dayRate)}/${m.rateUnit}`, { type: "machine", id: m.id });
    }
  } catch (e) {
    console.error("machine save failed", e);
    return { error: "Could not save the machine. Try again, and tell the CEO if it keeps failing." };
  }
  revalidatePath("/"); revalidatePath("/admin/fleet");
  return { ok: id ? `${data.name} saved.` : `${data.name} added to the fleet.` };
}

export async function toggleAvailable(fd: FormData) {
  const s = await requireSession();
  const id = str(fd, "id");
  const m = await prisma.machine.findUnique({ where: { id } });
  if (!m) return;
  await prisma.machine.update({ where: { id }, data: { available: !m.available } });
  await logActivity(s, "machine.availability", `${m.name} marked ${m.available ? "on hire" : "available"}`, { type: "machine", id });
  revalidatePath("/"); revalidatePath("/admin/fleet");
}

export async function deleteMachine(fd: FormData) {
  const s = await requireSuper();
  const id = str(fd, "id");
  const m = await prisma.machine.findUnique({ where: { id } });
  if (!m) return;
  await prisma.quoteRequest.updateMany({ where: { machineId: id }, data: { machineId: null } });
  await prisma.machine.delete({ where: { id } });
  await logActivity(s, "machine.delete", `Deleted ${m.name}`, { type: "machine", id });
  revalidatePath("/"); revalidatePath("/admin/fleet");
}

/* ---------- staff (super admin only) ---------- */
export async function createStaff(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSuper();
  const username = str(fd, "username").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") === "superadmin" ? "superadmin" : "admin";
  const password = String(fd.get("password") ?? "");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { error: "Username: 3 to 30 lowercase letters, numbers, dots or dashes." };
  if (name.length < 2) return { error: "Enter the person's name." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (await prisma.staff.findUnique({ where: { username } })) return { error: "That username is taken." };
  const st = await prisma.staff.create({ data: { username, name, role, passwordHash: hashPassword(password) } });
  await logActivity(s, "staff.create", `Created ${role} account "${username}" for ${name}`, { type: "staff", id: st.id });
  revalidatePath("/admin/staff");
  return { ok: `Account "${username}" created.` };
}

export async function setStaffActive(fd: FormData) {
  const s = await requireSuper();
  const id = str(fd, "id");
  const active = str(fd, "active") === "1";
  if (id === s.id) return; // cannot deactivate yourself
  const st = await prisma.staff.update({ where: { id }, data: { active } });
  await logActivity(s, "staff.active", `${active ? "Reactivated" : "Deactivated"} "${st.username}"`, { type: "staff", id });
  revalidatePath("/admin/staff");
}

export async function resetStaffPassword(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSuper();
  const id = str(fd, "id");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const st = await prisma.staff.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
  await logActivity(s, "staff.password", `Reset password for "${st.username}"`, { type: "staff", id });
  return { ok: `Password updated for ${st.username}.` };
}

export async function changeOwnPassword(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSession();
  const current = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? "");
  const me = await prisma.staff.findUnique({ where: { id: s.id } });
  if (!me || !verifyPassword(current, me.passwordHash)) return { error: "Current password is wrong." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  await prisma.staff.update({ where: { id: s.id }, data: { passwordHash: hashPassword(next) } });
  await logActivity(s, "staff.password", `${s.name} changed their own password`, { type: "staff", id: s.id });
  return { ok: "Password changed." };
}
