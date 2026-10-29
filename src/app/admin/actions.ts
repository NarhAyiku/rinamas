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
import { CATALOGUE, CHANGE_LABEL, catalogueCreateData, catalogueDiff, catalogueUpdateData, type CatalogueMachine, type DbMachineLite } from "@/data/catalogue";
import { getPricing, rulesOf, setPricing, type Pricing } from "@/lib/settings";
import { durationLabel, estimate } from "@/lib/pricing";
import { toRateMachine, toRateZone } from "@/lib/rates";
import defaultZones from "../../../prisma/default-zones.json";

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
  const photo = fd.get("photo");
  fd.delete("photo");
  const raw = Object.fromEntries(fd.entries());
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
  const s = await requireSession();
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
  const s = await requireSession();
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
  const s = await requireSession();
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
