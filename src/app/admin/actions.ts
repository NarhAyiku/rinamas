"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPassword, clearAdminCookie, isAdmin, setAdminCookie } from "@/lib/auth";
import { STATUSES } from "@/lib/format";

async function guard() { if (!(await isAdmin())) redirect("/admin/login"); }

export async function login(_prev: { error?: string } | undefined, fd: FormData) {
  const pw = String(fd.get("password") ?? "");
  if (!checkPassword(pw)) return { error: "Wrong password." };
  await setAdminCookie();
  redirect("/admin");
}

export async function logout() { await clearAdminCookie(); redirect("/admin/login"); }

export async function updateQuote(fd: FormData) {
  await guard();
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  const adminNote = String(fd.get("adminNote") ?? "").trim() || null;
  if (!(STATUSES as readonly string[]).includes(status)) return;
  await prisma.quoteRequest.update({ where: { id }, data: { status, adminNote } });
  revalidatePath("/admin");
}

const machineSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "slug: lowercase letters, numbers, dashes"),
  name: z.string().trim().min(2),
  category: z.enum(["earth", "haul", "road", "lift"]),
  categoryLabel: z.string().trim().min(2),
  image: z.string().trim().min(1),
  specs: z.string().trim(),
  dayRate: z.coerce.number().int().min(0),
  rateUnit: z.enum(["day", "trip"]),
  operatorRate: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  available: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
});

export async function saveMachine(fd: FormData) {
  await guard();
  const raw = Object.fromEntries(fd.entries());
  // specs come in as "Label: value" per line
  const specs = String(raw.specs ?? "").split("\n").map((l) => l.split(":")).filter((p) => p.length >= 2)
    .map(([k, ...v]) => [k.trim(), v.join(":").trim()]);
  const parsed = machineSchema.safeParse({ ...raw, specs: JSON.stringify(specs), available: raw.available === "on" });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid machine");
  const { id, operatorRate, ...rest } = parsed.data;
  const data = { ...rest, operatorRate: operatorRate === "" ? null : operatorRate };
  if (id) await prisma.machine.update({ where: { id }, data });
  else await prisma.machine.create({ data });
  revalidatePath("/"); revalidatePath("/admin/fleet");
}

export async function toggleAvailable(fd: FormData) {
  await guard();
  const id = String(fd.get("id"));
  const m = await prisma.machine.findUnique({ where: { id } });
  if (!m) return;
  await prisma.machine.update({ where: { id }, data: { available: !m.available } });
  revalidatePath("/"); revalidatePath("/admin/fleet");
}

export async function deleteMachine(fd: FormData) {
  await guard();
  const id = String(fd.get("id"));
  await prisma.quoteRequest.updateMany({ where: { machineId: id }, data: { machineId: null } });
  await prisma.machine.delete({ where: { id } });
  revalidatePath("/"); revalidatePath("/admin/fleet");
}
