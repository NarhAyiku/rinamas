import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeReference } from "@/lib/format";

const schema = z.object({
  machineId: z.string().min(1, "Choose a machine"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  duration: z.string().min(1).max(40),
  site: z.string().trim().min(3, "Tell us where the site is").max(200),
  operator: z.enum(["with", "without"]),
  fuel: z.enum(["with", "without"]),
  name: z.string().trim().min(2, "Your name is needed").max(80),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,20}$/, "Enter a valid phone number"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

// Simple per-process rate limit: 10 requests per IP per 10 minutes.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 10;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Please call dispatch instead." }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  }
  const d = parsed.data;
  const machine = d.machineId === "other" ? null : await prisma.machine.findUnique({ where: { id: d.machineId } });
  if (d.machineId !== "other" && !machine) return NextResponse.json({ error: "That machine is no longer listed. Pick another." }, { status: 400 });

  const quote = await prisma.quoteRequest.create({
    data: {
      reference: makeReference(),
      machineId: machine?.id ?? null,
      machineName: machine?.name ?? "Something else (see notes)",
      startDate: d.startDate, duration: d.duration, site: d.site,
      operator: d.operator, fuel: d.fuel, name: d.name, phone: d.phone,
      notes: d.notes || null,
    },
  });
  return NextResponse.json({ id: quote.id, reference: quote.reference }, { status: 201 });
}
