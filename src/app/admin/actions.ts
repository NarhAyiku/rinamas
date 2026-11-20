"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { bumpSessionVersion, clearSessionCookie, getSession, requireSession, requireSuper, setSessionCookie, type Session } from "@/lib/auth";
import { whereFrom } from "@/lib/device";
import { rateLimiter } from "@/lib/ratelimit";
import { notifyHandover } from "@/lib/notify";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logActivity } from "@/lib/activity";
import { ALL_STATUSES, STATUS_LABEL, ghs } from "@/lib/format";
import { storePhoto } from "@/lib/upload";
import { CATALOGUE, CHANGE_LABEL, catalogueCreateData, catalogueDiff, catalogueUpdateData, type CatalogueMachine, type DbMachineLite } from "@/data/catalogue";
import { getPricing, rulesOf, setPricing, type Pricing } from "@/lib/settings";
import { durationLabel, estimate } from "@/lib/pricing";
import { toRateMachine, toRateZone } from "@/lib/rates";
import { settlementFor } from "@/lib/money";
import { PAYMENT_KINDS, PAYMENT_METHODS, balanceOf, billOf } from "@/lib/settle";
import defaultZones from "../../../prisma/default-zones.json";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => { const v = str(fd, k); return v === "" ? null : Number(v); };

/* ---------- auth ---------- */
const LOCK_AFTER = 5, LOCK_MINUTES = 15;
const loginLimit = rateLimiter(30, 15 * 60_000); // per network, per server instance: a soft brake on guessing

export async function login(_prev: { error?: string } | undefined, fd: FormData) {
  const username = str(fd, "username").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const from = await whereFrom();
  if (loginLimit(from.ip)) return { error: "Too many sign-in attempts from this network. Wait 15 minutes and try again." };
  const staff = await prisma.staff.findUnique({ where: { username } });
  if (!staff || !staff.active) {
    verifyPassword(password, "scrypt$00$00"); // keep timing similar whether or not the user exists
    return { error: "Wrong username or password." };
  }
  if (staff.lockedUntil && staff.lockedUntil > new Date()) {
    const mins = Math.ceil((staff.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Too many wrong passwords. This account is locked for ${mins} more minute${mins === 1 ? "" : "s"}. The super admin can unlock it by setting a new password.` };
  }
  if (!verifyPassword(password, staff.passwordHash)) {
    const fails = staff.failedLogins + 1, lock = fails >= LOCK_AFTER;
    await prisma.staff.update({ where: { id: staff.id }, data: lock ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: fails } });
    // logged as "system" with the account as target: a wrong password is not necessarily the account holder
    await logActivity(null, lock ? "auth.locked" : "auth.fail", lock
      ? `"${staff.username}" locked for ${LOCK_MINUTES} minutes after ${LOCK_AFTER} wrong passwords in a row (last from ${from.device}, ${from.ip})`
      : `Wrong password for "${staff.username}" (${fails} of ${LOCK_AFTER}) from ${from.device}, ${from.ip}`, { type: "staff", id: staff.id });
    return { error: lock ? `Too many wrong passwords. This account is locked for ${LOCK_MINUTES} minutes.` : "Wrong username or password." };
  }
  await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  await setSessionCookie(staff.id, staff.sessionVersion);
  await logActivity({ id: staff.id, username: staff.username, name: staff.name, role: staff.role as Session["role"] }, "auth.login", `${staff.name} signed in on ${from.device} (${from.ip})`, { type: "staff", id: staff.id });
  redirect("/admin");
}

export async function logout() {
  const s = await getSession();
  if (s) await logActivity(s, "auth.logout", `${s.name} signed out`);
  await clearSessionCookie();
  redirect("/admin/login");
}

/* ---------- quote requests ---------- */
const NOTE_MAX = 1000;

/** The first person to work on a request (status, quote, hire details, money, hours) becomes its handler. Notes do not count. */
async function claimIfFree(quoteId: string, reference: string, s: Session) {
  const r = await prisma.quoteRequest.updateMany({ where: { id: quoteId, ownerId: null }, data: { ownerId: s.id, ownedAt: new Date() } });
  if (r.count) await logActivity(s, "quote.owner", `${reference}: ${s.name} is now handling it (first to work on it)`, { type: "quote", id: quoteId });
}

/** Take a request, hand it to someone else, or leave it not taken. Anyone on the desk can do this; it is logged. */
export async function setOwner(fd: FormData) {
  const s = await requireSession();
  const id = str(fd, "id");
  const to = str(fd, "ownerId") === "me" ? s.id : str(fd, "ownerId");
  const q = await prisma.quoteRequest.findUnique({ where: { id }, include: { owner: true } });
  if (!q || (q.ownerId ?? "") === to) return;
  const next = to ? await prisma.staff.findUnique({ where: { id: to } }) : null;
  if (to && (!next || !next.active)) return;
  const handed = !!next && next.id !== s.id;
  await prisma.quoteRequest.update({ where: { id }, data: { ownerId: next?.id ?? null, ownedAt: next ? new Date() : null, handedByName: handed ? s.name : null } });
  const was = q.owner?.name;
  const mail = handed ? await notifyHandover(id, s, next.id) : null;
  const summary = !next ? `${q.reference}: ${was ?? "nobody"} no longer handling it, now not taken`
    : next.id === s.id ? `${q.reference}: ${s.name} took it${was ? ` over from ${was}` : ""}`
    : `${q.reference}: handed ${was ? `from ${was} ` : ""}to ${next.name}${mail?.sent ? "; emailed them" : mail ? ` (not emailed: ${mail.reason})` : ""}`;
  await logActivity(s, "quote.owner", summary, { type: "quote", id });
  revalidatePath("/admin"); revalidatePath(`/admin/requests/${id}`);
}

/** Desk notes stack up with the writer's name. Nobody's note is overwritten. */
export async function addNote(fd: FormData) {
  const s = await requireSession();
  const quoteId = str(fd, "quoteId"), body = str(fd, "body").slice(0, NOTE_MAX);
  if (!body) return;
  const q = await prisma.quoteRequest.findUnique({ where: { id: quoteId } });
  if (!q) return;
  await prisma.quoteNote.create({ data: { quoteId, body, staffId: s.id, authorName: s.name } });
  await logActivity(s, "quote.note", `${q.reference}: note "${body}"`, { type: "quote", id: quoteId });
  revalidatePath("/admin"); revalidatePath(`/admin/requests/${quoteId}`);
}

/** The writer can remove their own note; the super admin can remove any. The text stays in the activity log. */
export async function deleteNote(fd: FormData) {
  const s = await requireSession();
  const n = await prisma.quoteNote.findUnique({ where: { id: str(fd, "id") }, include: { quote: true } });
  if (!n || (n.staffId !== s.id && s.role !== "superadmin")) return;
  await prisma.quoteNote.delete({ where: { id: n.id } });
  await logActivity(s, "quote.note", `${n.quote.reference}: removed ${n.staffId === s.id ? "own" : `${n.authorName}'s`} note "${n.body}"`, { type: "quote", id: n.quoteId });
  revalidatePath("/admin"); revalidatePath(`/admin/requests/${n.quoteId}`);
}

export async function updateQuote(fd: FormData) {
  const s = await requireSession();
  const id = str(fd, "id");
  const status = str(fd, "status");
  const note = str(fd, "note").slice(0, NOTE_MAX);
  if (!(ALL_STATUSES as readonly string[]).includes(status)) return;
  const before = await prisma.quoteRequest.findUnique({ where: { id }, include: { payments: true } });
  if (!before) return;
  // A job cannot be closed without money on it: the final bill is what the books count.
  if (status === "closed" && before.status !== "closed" && before.finalAmount == null) redirect(`/admin/requests/${id}?error=close-needs-bill`);
  if (before.status !== status) await prisma.quoteRequest.update({ where: { id }, data: { status } });
  if (note) await prisma.quoteNote.create({ data: { quoteId: id, body: note, staffId: s.id, authorName: s.name } });
  const changes: string[] = [];
  if (before.status !== status) {
    const owed = status === "closed" ? balanceOf(before, before.payments) : null;
    changes.push(`status ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[status]}${owed ? (owed > 0 ? ` with ${ghs(owed)} still owed` : ` with ${ghs(-owed)} to refund`) : ""}`);
  }
  if (note) changes.push(`note "${note}"`);
  if (changes.length) await logActivity(s, "quote.update", `${before.reference}: ${changes.join(", ")}`, { type: "quote", id });
  if (before.status !== status) await claimIfFree(id, before.reference, s);
  revalidatePath("/admin"); revalidatePath(`/admin/requests/${id}`); revalidatePath(`/quote/${id}`);
}

const hireSchema = z.object({
  quotedAmount: z.number().int().min(0).nullable(),
  depositAmount: z.number().int().min(0).nullable(),
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
  const label: Record<string, string> = { quotedAmount: "quote", depositAmount: "deposit required", siteAgentName: "site agent", siteAgentPhone: "site agent phone", dispatchDate: "dispatch date", dispatchMeter: "dispatch meter", dispatchNotes: "dispatch condition", returnDate: "return date", returnMeter: "return meter", returnNotes: "return condition" };
  for (const k of Object.keys(d) as (keyof typeof d)[]) {
    const a = before[k] ?? null, b = d[k] ?? null;
    if (String(a ?? "") !== String(b ?? "")) diffs.push(`${label[k]} → ${typeof b === "number" && (k === "quotedAmount" || k === "depositAmount") ? ghs(b) : (b ?? "cleared")}`);
  }
  if (diffs.length) { await logActivity(s, "quote.hire", `${before.reference}: ${diffs.join("; ")}`, { type: "quote", id }); await claimIfFree(id, before.reference, s); }
  revalidatePath(`/admin/requests/${id}`); revalidatePath(`/quote/${id}`); revalidatePath("/admin"); revalidatePath("/admin/finance");
}

/* ---------- money: payments and the final bill ---------- */
const paymentSchema = z.object({
  quoteId: z.string().min(1),
  kind: z.enum(Object.keys(PAYMENT_KINDS) as [keyof typeof PAYMENT_KINDS, ...(keyof typeof PAYMENT_KINDS)[]]),
  amount: z.number({ invalid_type_error: "Enter the amount in GH₵" }).int("Whole cedis only").min(1, "Amount must be at least GH₵ 1").max(10_000_000),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [keyof typeof PAYMENT_METHODS, ...(keyof typeof PAYMENT_METHODS)[]], { errorMap: () => ({ message: "Choose how it was paid" }) }),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date it was paid"),
  reference: z.string().max(80).nullable(),
  note: z.string().max(300).nullable(),
});
export type MoneyState = { error?: string; ok?: string } | undefined;
const revalidateMoney = (id: string) => { revalidatePath(`/admin/requests/${id}`); revalidatePath(`/quote/${id}`); revalidatePath("/admin"); revalidatePath("/admin/finance"); };

export async function recordPayment(_prev: MoneyState, fd: FormData): Promise<MoneyState> {
  const s = await requireSession();
  const parsed = paymentSchema.safeParse({
    quoteId: str(fd, "quoteId"), kind: str(fd, "kind"), amount: num(fd, "amount"), method: str(fd, "method"), paidAt: str(fd, "paidAt"),
    reference: str(fd, "reference") || null, note: str(fd, "note") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the payment." };
  const d = parsed.data;
  if (d.paidAt > new Date().toISOString().slice(0, 10)) return { error: "The payment date is in the future." };
  const q = await prisma.quoteRequest.findUnique({ where: { id: d.quoteId }, include: { payments: true } });
  if (!q) return { error: "That request no longer exists." };
  await prisma.payment.create({ data: { ...d, loggedBy: s.name } });
  const after = balanceOf(q, [...q.payments, d]);
  const via = `${PAYMENT_METHODS[d.method]}${d.reference ? ` ref ${d.reference}` : ""}`;
  await logActivity(s, "payment.add", `${q.reference}: ${PAYMENT_KINDS[d.kind].toLowerCase()} ${d.kind === "refund" ? "paid out" : "received"} ${ghs(d.amount)} by ${via} on ${d.paidAt}${after != null ? `; balance → ${ghs(after)}` : ""}`, { type: "quote", id: q.id });
  await claimIfFree(q.id, q.reference, s);
  revalidateMoney(q.id);
  return { ok: `${PAYMENT_KINDS[d.kind]} of ${ghs(d.amount)} recorded.` };
}

/** Payments are the books: only the super admin can remove one, and the removal is logged in full. */
export async function deletePayment(fd: FormData) {
  const s = await requireSuper();
  const p = await prisma.payment.findUnique({ where: { id: str(fd, "id") }, include: { quote: true } });
  if (!p) return;
  await prisma.payment.delete({ where: { id: p.id } });
  await logActivity(s, "payment.delete", `${p.quote.reference}: removed ${PAYMENT_KINDS[p.kind as keyof typeof PAYMENT_KINDS]?.toLowerCase() ?? p.kind} ${ghs(p.amount)} (${PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}, ${p.paidAt}, logged by ${p.loggedBy ?? "unknown"})`, { type: "quote", id: p.quoteId });
  revalidateMoney(p.quoteId);
}

/** Sets the final bill: either the settlement worked out on the server from the record, or an amount staff type in. */
export async function setFinalBill(_prev: MoneyState, fd: FormData): Promise<MoneyState> {
  const s = await requireSession();
  const id = str(fd, "id"), mode = str(fd, "mode");
  const [q, pricing] = await Promise.all([
    prisma.quoteRequest.findUnique({ where: { id }, include: { machine: true, hourLogs: true, payments: true } }),
    getPricing(),
  ]);
  if (!q) return { error: "That request no longer exists." };
  let amount: number, finalJson: string | null = null, how: string;
  if (mode === "settlement") {
    const st = settlementFor(q, rulesOf(pricing));
    if (!st) return { error: "This request has no listed machine: type the final bill instead." };
    if (!st.ok) return { error: `${st.reason}.` };
    amount = st.total;
    finalJson = JSON.stringify({ ...st, computedAt: new Date().toISOString(), by: s.name, reviewedAt: pricing.reviewedAt });
    how = `from the settlement (${st.days.onHire} days on hire, ${st.days.standby} standby)`;
  } else {
    const v = num(fd, "finalAmount");
    if (v == null || !Number.isInteger(v) || v < 0 || v > 100_000_000) return { error: "Enter the final bill as whole cedis." };
    amount = v;
    how = "typed in";
  }
  const reason = str(fd, "reason").slice(0, 200);
  const bill = billOf(q);
  if (mode !== "settlement" && q.finalAmount != null && q.finalAmount !== amount && reason.length < 4) return { error: "Say why the final bill is changing; it goes in the activity log." };
  await prisma.quoteRequest.update({ where: { id }, data: { finalAmount: amount, finalJson, finalSetAt: new Date(), finalSetBy: s.name } });
  const after = balanceOf({ finalAmount: amount, quotedAmount: q.quotedAmount }, q.payments);
  await logActivity(s, "quote.final", `${q.reference}: final bill ${q.finalAmount != null ? `${ghs(q.finalAmount)} → ` : ""}${ghs(amount)} ${how}${bill != null && q.finalAmount == null ? ` (quoted ${ghs(bill)})` : ""}${reason ? `, "${reason}"` : ""}; balance ${ghs(after ?? amount)}`, { type: "quote", id });
  await claimIfFree(id, q.reference, s);
  revalidateMoney(id);
  return { ok: `Final bill set at ${ghs(amount)}.` };
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
  await claimIfFree(quoteId, q.reference, s);
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
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "use lowercase letters, numbers and dashes only, e.g. jcb-telehandler"),
  name: z.string().trim().min(2),
  category: z.enum(["earth", "haul", "road", "lift"]),
  categoryLabel: z.string().trim().min(2),
  image: z.string().trim(),
  specs: z.string().trim(),
  dayRate: z.coerce.number().int().min(0),
  rateUnit: z.enum(["day", "trip"]),
  operatorRate: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  available: z.coerce.boolean(),
  priceOnRequest: z.coerce.boolean(),
  fuelLPerDay: z.union([z.literal(""), z.coerce.number().int().min(0).max(5000)]),
  selfDrive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
});

export type MachineFormState = { error?: string; ok?: string } | undefined;

export async function saveMachine(_prev: MachineFormState, fd: FormData): Promise<MachineFormState> {
  const s = await requireSession();
  const isSuper = s.role === "superadmin";
  const editId = str(fd, "id");
  if (!isSuper && !editId) return { error: "Only the super admin can add a machine, because it needs a rate." };
  const photo = fd.get("photo");
  fd.delete("photo");
  const raw: Record<string, FormDataEntryValue | undefined> = Object.fromEntries(fd.entries());
  // What a customer pays (rate, unit, operator, diesel, price on request, self-drive) is the super admin's call:
  // an admin's save keeps the stored values whatever the form sends.
  if (!isSuper) {
    const cur = await prisma.machine.findUnique({ where: { id: editId } });
    if (!cur) return { error: "That machine no longer exists." };
    raw.dayRate = String(cur.dayRate); raw.rateUnit = cur.rateUnit;
    raw.operatorRate = cur.operatorRate == null ? "" : String(cur.operatorRate);
    raw.fuelLPerDay = cur.fuelLPerDay == null ? "" : String(cur.fuelLPerDay);
    raw.priceOnRequest = cur.priceOnRequest ? "on" : undefined;
    raw.selfDrive = cur.selfDrive ? "on" : undefined;
  }
  const specs = String(raw.specs ?? "").split("\n").map((l) => l.split(":")).filter((p) => p.length >= 2)
    .map(([k, ...v]) => [k.trim(), v.join(":").trim()]);
  const parsed = machineSchema.safeParse({ ...raw, specs: JSON.stringify(specs), available: raw.available === "on", priceOnRequest: raw.priceOnRequest === "on", fuelLPerDay: raw.fuelLPerDay ?? "", selfDrive: raw.selfDrive === "on" });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${i?.path?.[0] ? String(i.path[0]) + ": " : ""}${i?.message ?? "Check the machine details."}` };
  }
  const { id, operatorRate, fuelLPerDay, ...rest } = parsed.data;
  const data = { ...rest, operatorRate: operatorRate === "" ? null : operatorRate, fuelLPerDay: fuelLPerDay === "" ? null : fuelLPerDay };
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
      if (before && before.rateUnit !== data.rateUnit) diffs.push(`per ${before.rateUnit} → per ${data.rateUnit}`);
      if (before && (before.operatorRate ?? null) !== data.operatorRate) diffs.push(`operator ${before.operatorRate != null ? ghs(before.operatorRate) : "included"} → ${data.operatorRate != null ? ghs(data.operatorRate) : "included"}/day`);
      if (before && before.name !== data.name) diffs.push(`renamed from "${before.name}"`);
      if (before && before.available !== data.available) diffs.push(data.available ? "marked available" : "marked on hire");
      if (before && before.priceOnRequest !== data.priceOnRequest) diffs.push(data.priceOnRequest ? "price hidden (on request)" : "price shown");
      if (before && before.image !== data.image) diffs.push("photo replaced");
      if (before && (before.fuelLPerDay ?? null) !== data.fuelLPerDay) diffs.push(`diesel allowance ${before.fuelLPerDay ?? "none"} → ${data.fuelLPerDay ?? "none"} L/day`);
      if (before && before.selfDrive !== data.selfDrive) diffs.push(data.selfDrive ? "drives itself to site (no low bed)" : "moves by low bed");
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
  const email = str(fd, "email").toLowerCase() || null;
  if (email && !z.string().email().max(120).safeParse(email).success) return { error: "That email address doesn't look right." };
  if (await prisma.staff.findUnique({ where: { username } })) return { error: "That username is taken." };
  const st = await prisma.staff.create({ data: { username, name, role, email, passwordHash: hashPassword(password) } });
  await logActivity(s, "staff.create", `Created ${role} account "${username}" for ${name}`, { type: "staff", id: st.id });
  revalidatePath("/admin/staff");
  return { ok: `Account "${username}" created.` };
}

export async function setStaffActive(fd: FormData) {
  const s = await requireSuper();
  const id = str(fd, "id");
  const active = str(fd, "active") === "1";
  if (id === s.id) return; // cannot deactivate yourself
  const st = await prisma.staff.update({ where: { id }, data: { active, ...(active ? {} : { sessionVersion: { increment: 1 } }) } });
  await logActivity(s, "staff.active", `${active ? "Reactivated" : "Deactivated"} "${st.username}"`, { type: "staff", id });
  revalidatePath("/admin/staff");
}

export async function resetStaffPassword(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSuper();
  const id = str(fd, "id");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  // a reset also unlocks the account and signs it out on every device
  const st = await prisma.staff.update({ where: { id }, data: { passwordHash: hashPassword(password), sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null } });
  if (st.id === s.id) await setSessionCookie(st.id, st.sessionVersion);
  await logActivity(s, "staff.password", `Reset password for "${st.username}"; signed out on every device${st.id === s.id ? " except this one" : ""}`, { type: "staff", id });
  return { ok: st.id === s.id ? "Your password is updated. Your other devices are signed out." : `Password updated for ${st.username}. They are signed out everywhere and must sign in with the new password.` };
}

export async function changeOwnPassword(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSession();
  const current = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? "");
  const me = await prisma.staff.findUnique({ where: { id: s.id } });
  if (!me || !verifyPassword(current, me.passwordHash)) return { error: "Current password is wrong." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const me2 = await prisma.staff.update({ where: { id: s.id }, data: { passwordHash: hashPassword(next), sessionVersion: { increment: 1 } } });
  await setSessionCookie(s.id, me2.sessionVersion); // keep this device signed in; every other one is now signed out
  await logActivity(s, "staff.password", `${s.name} changed their own password; other devices signed out`, { type: "staff", id: s.id });
  return { ok: "Password changed. Any other phone or computer signed in as you has been signed out." };
}

/** Where my desk alerts go, and whether I get them. */
export async function saveMyAlerts(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSession();
  const email = str(fd, "email").toLowerCase() || null;
  const alerts = fd.get("alerts") === "on";
  if (email && !z.string().email().max(120).safeParse(email).success) return { error: "That email address doesn't look right." };
  const before = await prisma.staff.findUnique({ where: { id: s.id } });
  if (!before) return { error: "Account not found." };
  await prisma.staff.update({ where: { id: s.id }, data: { email, alerts } });
  const diffs: string[] = [];
  if ((before.email ?? null) !== email) diffs.push(email ? `alert email → ${email}` : "alert email removed");
  if (before.alerts !== alerts) diffs.push(alerts ? "alerts turned on" : "alerts turned off");
  if (diffs.length) await logActivity(s, "staff.alerts", `${s.name}: ${diffs.join(", ")}`, { type: "staff", id: s.id });
  revalidatePath("/admin/account"); revalidatePath("/admin/staff");
  return { ok: !email ? "Saved. Add an email to get alerts." : alerts ? "Saved. Alerts will go to " + email + "." : "Saved. Alerts are off." };
}

/** Super admin sets someone's alert email (for staff who won't do it themselves). */
export async function setStaffEmail(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSuper();
  const id = str(fd, "id"), email = str(fd, "email").toLowerCase() || null;
  if (email && !z.string().email().max(120).safeParse(email).success) return { error: "That email address doesn't look right." };
  const before = await prisma.staff.findUnique({ where: { id } });
  if (!before) return { error: "Account not found." };
  await prisma.staff.update({ where: { id }, data: { email } });
  await logActivity(s, "staff.alerts", `Alert email for "${before.username}": ${before.email ?? "none"} → ${email ?? "none"}`, { type: "staff", id });
  revalidatePath("/admin/staff");
  return { ok: email ? `Alerts for ${before.name} go to ${email}.` : `Removed ${before.name}'s alert email.` };
}

export async function signOutOtherDevices(_prev: { error?: string; ok?: string } | undefined, _fd: FormData) {
  const s = await requireSession();
  const v = await bumpSessionVersion(s.id);
  await setSessionCookie(s.id, v);
  const from = await whereFrom();
  await logActivity(s, "auth.others", `${s.name} signed out every other device (kept ${from.device})`, { type: "staff", id: s.id });
  return { ok: "Done. Only this device is signed in as you now." };
}

/* ---------- pricing display and hire rules ---------- */
const rulesSchema = z.object({
  dayHours: z.number().int().min(1).max(24),
  minDays: z.number().int().min(1).max(30),
  weekDays: z.number().int().min(1).max(7),
  weekDiscountPct: z.number().min(0).max(90),
  monthDays: z.number().int().min(1).max(31),
  monthDiscountPct: z.number().min(0).max(90),
  dieselPrice: z.number().positive().nullable(),
  perKmBeyond: z.number().min(0).max(10000),
  vatPct: z.number().min(0).max(50),
  vatIncluded: z.boolean(),
  standbyPct: z.number().min(0).max(100),
  depositPct: z.number().min(0).max(100),
});
const RULE_LABEL: Record<string, string> = {
  dayHours: "Hours in a day", minDays: "Minimum hire", weekDays: "Days in a week", weekDiscountPct: "Week discount", monthDays: "Days in a month", monthDiscountPct: "Month discount",
  dieselPrice: "Diesel price", perKmBeyond: "Per km beyond the zones", vatPct: "VAT", vatIncluded: "VAT included", standbyPct: "Standby", depositPct: "Deposit",
};

export async function savePricing(_prev: { error?: string; ok?: string } | undefined, fd: FormData) {
  const s = await requireSuper();
  const showPrices = str(fd, "showPrices") === "true";
  const note = str(fd, "note").slice(0, 600);
  const reviewedAt = str(fd, "reviewedAt");
  const usdRate = str(fd, "usdRate");
  if (reviewedAt && !/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)) return { error: "Review date must be a valid date." };
  if (usdRate && !(Number(usdRate) > 0)) return { error: "GH₵ per US$ must be a positive number." };
  if (note.length < 20) return { error: "Write a pricing note of at least 20 characters; customers read it." };
  const before = await getPricing();
  // Rule scalars: a field left out of the form keeps its current value, so older forms still save.
  const n = (k: keyof Pricing) => (fd.has(k) ? num(fd, k) : (before[k] as number | null));
  const rules = rulesSchema.safeParse({
    dayHours: n("dayHours"), minDays: n("minDays"), weekDays: n("weekDays"), weekDiscountPct: n("weekDiscountPct"), monthDays: n("monthDays"), monthDiscountPct: n("monthDiscountPct"),
    dieselPrice: n("dieselPrice"), perKmBeyond: n("perKmBeyond"), vatPct: n("vatPct"), vatIncluded: fd.has("vatPct") ? str(fd, "vatIncluded") === "on" : before.vatIncluded,
    standbyPct: n("standbyPct"), depositPct: n("depositPct"),
  });
  if (!rules.success) {
    const i = rules.error.issues[0];
    return { error: `${RULE_LABEL[String(i?.path?.[0])] ?? "Hire rules"}: ${i?.message?.replace(/^Expected number, received null$/, "enter a number") ?? "check the value"}.` };
  }
  if (rules.data.monthDays < rules.data.weekDays) return { error: "Days in a month must be at least the days in a week." };
  const next: Pricing = { ...rules.data, showPrices, note, reviewedAt: reviewedAt || null, usdRate: usdRate || null };
  await setPricing(next);
  const diffs: string[] = [];
  if (before.showPrices !== showPrices) diffs.push(showPrices ? "rates now shown on site" : "rates hidden, price on request");
  if (before.note !== note) diffs.push("pricing note edited");
  if ((before.reviewedAt ?? "") !== reviewedAt) diffs.push(`reviewed date → ${reviewedAt || "cleared"}`);
  if ((before.usdRate ?? "") !== usdRate) diffs.push(`USD rate → ${usdRate || "cleared"}`);
  for (const k of Object.keys(rules.data) as (keyof typeof rules.data)[]) {
    const a = before[k], b = rules.data[k];
    if (String(a ?? "") !== String(b ?? "")) {
      const pct = /Pct$/.test(k), money = k === "dieselPrice" || k === "perKmBeyond";
      const show = (v: unknown) => v == null || v === "" ? "none" : typeof v === "boolean" ? (v ? "yes" : "no") : pct ? `${v}%` : money ? ghs(Number(v)) : String(v);
      diffs.push(`${RULE_LABEL[k]} ${show(a)} → ${show(b)}`);
    }
  }
  if (diffs.length) await logActivity(s, "pricing.save", diffs.join(", "));
  revalidatePath("/"); revalidatePath("/admin/pricing"); revalidatePath("/admin/calculator");
  return { ok: "Pricing saved." };
}

/* ---------- transport zones ---------- */
export type ZoneFormState = { error?: string; ok?: string } | undefined;
const zoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "give the zone a short name, e.g. A").max(12),
  label: z.string().trim().min(2, "describe the band, e.g. Within 30 km of the yard").max(60),
  towns: z.string().trim().min(2, "list a few towns so customers can pick the right zone").max(200),
  maxKm: z.coerce.number().int().min(1).max(2000),
  lowBedEachWay: z.coerce.number().int().min(0).max(1_000_000),
  sortOrder: z.coerce.number().int(),
});

export async function saveZone(_prev: ZoneFormState, fd: FormData): Promise<ZoneFormState> {
  const s = await requireSuper();
  const parsed = zoneSchema.safeParse({
    id: str(fd, "id") || undefined, name: str(fd, "name").toUpperCase(), label: str(fd, "label"), towns: str(fd, "towns"),
    maxKm: str(fd, "maxKm"), lowBedEachWay: str(fd, "lowBedEachWay"), sortOrder: str(fd, "sortOrder") || "0",
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${i?.path?.[0] ? String(i.path[0]) + ": " : ""}${i?.message ?? "Check the zone details."}` };
  }
  const { id, ...data } = parsed.data;
  try {
    if (id) {
      const before = await prisma.zone.findUnique({ where: { id } });
      if (!before) return { error: "That zone no longer exists." };
      const clash = await prisma.zone.findUnique({ where: { name: data.name } });
      if (clash && clash.id !== id) return { error: `A zone named "${data.name}" already exists.` };
      await prisma.zone.update({ where: { id }, data });
      const diffs: string[] = [];
      if (before.name !== data.name) diffs.push(`renamed ${before.name} → ${data.name}`);
      if (before.label !== data.label) diffs.push(`label "${before.label}" → "${data.label}"`);
      if (before.towns !== data.towns) diffs.push(`towns → ${data.towns}`);
      if (before.maxKm !== data.maxKm) diffs.push(`reach ${before.maxKm} → ${data.maxKm} km`);
      if (before.lowBedEachWay !== data.lowBedEachWay) diffs.push(`low bed each way ${ghs(before.lowBedEachWay)} → ${ghs(data.lowBedEachWay)}`);
      if (before.sortOrder !== data.sortOrder) diffs.push(`order ${before.sortOrder} → ${data.sortOrder}`);
      if (diffs.length) await logActivity(s, "zone.save", `Zone ${data.name}: ${diffs.join(", ")}`);
    } else {
      if (await prisma.zone.findUnique({ where: { name: data.name } })) return { error: `A zone named "${data.name}" already exists.` };
      const z = await prisma.zone.create({ data });
      await logActivity(s, "zone.create", `Added zone ${z.name} (${z.label}, up to ${z.maxKm} km) at ${ghs(z.lowBedEachWay)} each way`);
    }
  } catch (e) {
    console.error("zone save failed", e);
    return { error: "Could not save the zone. Try again." };
  }
  revalidatePath("/"); revalidatePath("/admin/pricing"); revalidatePath("/admin/calculator");
  return { ok: id ? `Zone ${data.name} saved.` : `Zone ${data.name} added.` };
}

export async function setZoneActive(fd: FormData) {
  const s = await requireSuper();
  const id = str(fd, "id");
  const active = str(fd, "active") === "1";
  const z = await prisma.zone.findUnique({ where: { id } });
  if (!z || z.active === active) return;
  await prisma.zone.update({ where: { id }, data: { active } });
  await logActivity(s, "zone.active", `Zone ${z.name} ${active ? "reactivated" : "deactivated (hidden from the estimator, kept for old quotes)"}`);
  revalidatePath("/"); revalidatePath("/admin/pricing"); revalidatePath("/admin/calculator");
}

/** Loads prisma/default-zones.json when the table is empty. Super admin only: prod data is never seeded from this sandbox. */
export async function seedDefaultZones() {
  const s = await requireSuper();
  if (await prisma.zone.count()) return;
  for (const z of defaultZones.zones) {
    await prisma.zone.create({ data: { name: z.name, label: z.label, towns: z.towns, maxKm: z.maxKm, lowBedEachWay: z.lowBedEachWay, sortOrder: z.sortOrder } });
  }
  await logActivity(s, "zone.seed", `Seeded ${defaultZones.zones.length} default zones (${defaultZones.zones.map((z) => `${z.name} ${ghs(z.lowBedEachWay)}`).join(", ")}) with placeholder prices`);
  revalidatePath("/"); revalidatePath("/admin/pricing"); revalidatePath("/admin/calculator");
}

/* ---------- quote calculator ---------- */
export type ApplyEstimateState = { error?: string; ok?: string } | undefined;

/** Recomputes the estimate on the server from the calculator's inputs and writes it to an open request as the quote. */
export async function applyEstimate(_prev: ApplyEstimateState, fd: FormData): Promise<ApplyEstimateState> {
  const s = await requireSession();
  const quoteId = str(fd, "quoteId"), machineId = str(fd, "machineId"), zoneId = str(fd, "zoneId");
  const days = Number(str(fd, "days")), km = num(fd, "km"), trips = num(fd, "trips");
  const operator = str(fd, "operator") === "with", fuel = str(fd, "fuel") === "with";
  if (!quoteId) return { error: "Pick the request this estimate is for." };
  if (!machineId) return { error: "Pick a machine first." };
  if (!(Number.isInteger(days) && days >= 1 && days <= 365)) return { error: "Days must be a whole number from 1 to 365." };
  const [q, machine, zone, pricing] = await Promise.all([
    prisma.quoteRequest.findUnique({ where: { id: quoteId } }),
    prisma.machine.findUnique({ where: { id: machineId } }),
    zoneId ? prisma.zone.findUnique({ where: { id: zoneId } }) : Promise.resolve(null),
    getPricing(),
  ]);
  if (!q) return { error: "That request no longer exists." };
  if (!machine) return { error: "That machine is no longer listed." };
  if (zoneId && !zone) return { error: "That zone no longer exists." };
  if (q.status !== "new" && q.status !== "quoted") return { error: `${q.reference} is ${STATUS_LABEL[q.status]}; only new or quoted requests take a new estimate.` };
  const rules = rulesOf(pricing);
  const est = estimate({ machine: toRateMachine(machine), days, zone: zone ? toRateZone(zone) : null, km, trips, operator, fuel, rules });
  if (!est.ok) return { error: `${machine.name}: ${est.reason}.` };
  const snapshot = {
    ...est, machineId: machine.id, machineName: machine.name, zone: zone ? { id: zone.id, name: zone.name, label: zone.label, towns: zone.towns } : null,
    km, trips, operator, fuel, rules, reviewedAt: pricing.reviewedAt, usdRate: pricing.usdRate, computedAt: new Date().toISOString(), source: "calculator", by: s.name,
  };
  const machineChanged = q.machineId !== machine.id;
  const setDeposit = q.depositAmount == null && !q.depositPaidAt;
  await prisma.quoteRequest.update({
    where: { id: quoteId },
    data: {
      quotedAmount: est.total, days, zoneId: zone?.id ?? null, estimateTotal: est.total, estimateJson: JSON.stringify(snapshot), duration: durationLabel(days),
      operator: operator ? "with" : "without", fuel: fuel ? "with" : "without",
      ...(setDeposit ? { depositAmount: est.deposit } : {}),
      ...(machineChanged ? { machineId: machine.id, machineName: machine.name } : {}),
    },
  });
  const where = zone ? `Zone ${zone.name}` : km ? `${km} km` : "transport to be quoted";
  const parts = [`quote ${q.quotedAmount != null ? `${ghs(q.quotedAmount)} → ` : "→ "}${ghs(est.total)} from the calculator (${durationLabel(days)}, ${where}, ${operator ? "with" : "without"} operator, ${fuel ? "with" : "without"} fuel)`];
  if (setDeposit) parts.push(`deposit → ${ghs(est.deposit)}`);
  if (machineChanged) parts.push(`machine ${q.machineName} → ${machine.name}`);
  await logActivity(s, "quote.hire", `${q.reference}: ${parts.join("; ")}`, { type: "quote", id: quoteId });
  await claimIfFree(quoteId, q.reference, s);
  revalidatePath(`/admin/requests/${quoteId}`); revalidatePath(`/quote/${quoteId}`); revalidatePath("/admin"); revalidatePath("/admin/calculator");
  return { ok: `${q.reference} quoted at ${ghs(est.total)}${setDeposit ? `, deposit ${ghs(est.deposit)}` : ""}.` };
}

/* ---------- catalogue sync (super admin only) ----------
   src/data/catalogue.json is the master for names, categories, specs, stock photos and order. These actions copy it into
   the yard database row by row. Rates, availability and price-on-request belong to staff and are never written here;
   a photo is only replaced while the row still uses a stock /img/ picture. */
export type CatalogueState = { error?: string; ok?: string } | undefined;
const revalidateCatalogue = () => { revalidatePath("/"); revalidatePath("/admin/fleet"); revalidatePath("/admin/catalogue"); };
const catalogueEntry = (slug: string) => CATALOGUE.find((c) => c.slug === slug);

async function addFromCatalogue(s: Session, c: CatalogueMachine) {
  const m = await prisma.machine.create({ data: catalogueCreateData(c) });
  await logActivity(s, "catalogue.add", `Added ${m.name} from the catalogue at ${ghs(m.dayRate)}/${m.rateUnit}`, { type: "machine", id: m.id });
  return m;
}

async function updateFromCatalogue(s: Session, c: CatalogueMachine, db: DbMachineLite & { id: string }) {
  const changes = catalogueDiff(c, db);
  if (!changes.length) return changes;
  await prisma.machine.update({ where: { id: db.id }, data: catalogueUpdateData(changes) });
  const summary = changes.map((ch) => (ch.field === "specs" ? "specs rewritten" : `${CHANGE_LABEL[ch.field]} "${ch.from}" → "${ch.to}"`)).join(", ");
  await logActivity(s, "catalogue.update", `${c.name}: ${summary}`, { type: "machine", id: db.id });
  return changes;
}

export async function catalogueAdd(_prev: CatalogueState, fd: FormData): Promise<CatalogueState> {
  const s = await requireSuper();
  const c = catalogueEntry(str(fd, "slug"));
  if (!c) return { error: "That machine is not in the catalogue." };
  if (await prisma.machine.findUnique({ where: { slug: c.slug } })) return { error: `${c.name} is already on the yard.` };
  const m = await addFromCatalogue(s, c);
  revalidateCatalogue();
  return { ok: `${m.name} added.` };
}

export async function catalogueUpdate(_prev: CatalogueState, fd: FormData): Promise<CatalogueState> {
  const s = await requireSuper();
  const c = catalogueEntry(str(fd, "slug"));
  if (!c) return { error: "That machine is not in the catalogue." };
  const db = await prisma.machine.findUnique({ where: { slug: c.slug } });
  if (!db) return { error: `${c.name} is not on the yard yet; add it first.` };
  const changes = await updateFromCatalogue(s, c, db);
  revalidateCatalogue();
  return { ok: changes.length ? `${c.name} updated: ${changes.map((ch) => CHANGE_LABEL[ch.field]).join(", ")}.` : `${c.name} was already up to date.` };
}

/** A yard row that is no longer in the catalogue: deleted when nothing refers to it, otherwise hidden so hire records keep their machine. */
export async function catalogueRemove(_prev: CatalogueState, fd: FormData): Promise<CatalogueState> {
  const s = await requireSuper();
  const id = str(fd, "id");
  const m = await prisma.machine.findUnique({ where: { id }, include: { _count: { select: { quotes: true } } } });
  if (!m) return { error: "That machine is no longer on the yard." };
  if (catalogueEntry(m.slug)) return { error: `${m.name} is still in the catalogue, so it stays.` };
  if (m._count.quotes === 0) {
    await prisma.machine.delete({ where: { id } });
    await logActivity(s, "catalogue.remove", `Removed ${m.name}: not in the catalogue, no hire records`, { type: "machine", id });
    revalidateCatalogue();
    return { ok: `${m.name} removed from the yard.` };
  }
  if (!m.hidden) {
    await prisma.machine.update({ where: { id }, data: { hidden: true, available: false } });
    await logActivity(s, "catalogue.retire", `Retired ${m.name}: not in the catalogue, hidden from the site, ${m._count.quotes} hire record(s) kept`, { type: "machine", id });
  }
  revalidateCatalogue();
  return { ok: `${m.name} hidden from the site; its hire records are kept.` };
}

export async function catalogueRestore(_prev: CatalogueState, fd: FormData): Promise<CatalogueState> {
  const s = await requireSuper();
  const id = str(fd, "id");
  const m = await prisma.machine.findUnique({ where: { id } });
  if (!m) return { error: "That machine is no longer on the yard." };
  if (m.hidden) {
    await prisma.machine.update({ where: { id }, data: { hidden: false, available: true } });
    await logActivity(s, "catalogue.restore", `Restored ${m.name} to the public site and marked it available`, { type: "machine", id });
  }
  revalidateCatalogue();
  return { ok: `${m.name} is back on the site.` };
}

/** Every add and update in one go. Never removes or retires anything. */
export async function catalogueApplyAll(_prev: CatalogueState, _fd: FormData): Promise<CatalogueState> {
  const s = await requireSuper();
  const db = await prisma.machine.findMany();
  const bySlug = new Map(db.map((m) => [m.slug, m]));
  let added = 0, updated = 0;
  for (const c of CATALOGUE) {
    const m = bySlug.get(c.slug);
    if (!m) { await addFromCatalogue(s, c); added++; continue; }
    if ((await updateFromCatalogue(s, c, m)).length) updated++;
  }
  revalidateCatalogue();
  return { ok: added + updated ? `Applied: ${added} added, ${updated} updated. Nothing was removed.` : "Everything was already up to date." };
}
