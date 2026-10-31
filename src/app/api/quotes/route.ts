import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeReference } from "@/lib/format";
import { getPricing, rulesOf } from "@/lib/settings";
import { toRateMachine, toRateZone } from "@/lib/rates";
import { daysFromDuration, durationLabel, estimate } from "@/lib/pricing";

const schema = z.object({
  machineId: z.string().min(1, "Choose a machine"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  days: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ invalid_type_error: "How many days do you need the machine?" }).int("Days must be a whole number").min(1, "At least one day").max(365, "For hires over a year, call dispatch").optional()),
  duration: z.string().max(40).optional().or(z.literal("")), // legacy forms sent a duration string
  zoneId: z.string().max(40).optional().or(z.literal("")),
  site: z.string().trim().min(3, "Tell us where the site is").max(200),
  operator: z.enum(["with", "without"]),
  fuel: z.enum(["with", "without"]),
  name: z.string().trim().min(2, "Tell us your name").max(80),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,20}$/, "Check your phone number so we can call you back"),
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
  if (limited(ip)) return NextResponse.json({ error: "Lots of requests from this connection just now. Please call or WhatsApp dispatch instead." }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  }
  const d = parsed.data;
  const pricing = await getPricing();
  const days = d.days ?? daysFromDuration(d.duration, rulesOf(pricing));
  if (!days) return NextResponse.json({ error: "How many days do you need the machine?" }, { status: 400 });

  const [machine, zone] = await Promise.all([
    d.machineId === "other" ? null : prisma.machine.findUnique({ where: { id: d.machineId } }),
    d.zoneId ? prisma.zone.findUnique({ where: { id: d.zoneId } }) : null,
  ]);
  if (d.machineId !== "other" && !machine) return NextResponse.json({ error: "That machine is no longer listed. Pick another." }, { status: 400 });
  if (d.zoneId && !zone) return NextResponse.json({ error: "That zone is no longer listed. Pick again." }, { status: 400 });

  // The estimate is recomputed here from the database; nothing priced in the browser is trusted or stored.
  let estimateTotal: number | null = null, estimateJson: string | null = null;
  if (machine && pricing.showPrices && !machine.priceOnRequest) {
    const rules = rulesOf(pricing);
    const est = estimate({ machine: toRateMachine(machine), days, zone: zone ? toRateZone(zone) : null, operator: d.operator === "with", fuel: d.fuel === "with", rules });
    if (est.ok) {
      estimateTotal = est.total;
      estimateJson = JSON.stringify({
        ...est, machineId: machine.id, machineName: machine.name, zone: zone ? { id: zone.id, name: zone.name, label: zone.label, towns: zone.towns } : null,
        km: null, trips: null, operator: d.operator === "with", fuel: d.fuel === "with", rules, reviewedAt: pricing.reviewedAt, usdRate: pricing.usdRate,
        computedAt: new Date().toISOString(), source: "site",
      });
    }
  }

  const quote = await prisma.quoteRequest.create({
    data: {
      reference: makeReference(),
      machineId: machine?.id ?? null,
      machineName: machine?.name ?? "Something else (see notes)",
      startDate: d.startDate, duration: durationLabel(days), days, site: d.site,
      zoneId: zone?.id ?? null, estimateTotal, estimateJson,
      operator: d.operator, fuel: d.fuel, name: d.name, phone: d.phone,
      notes: d.notes || null,
    },
  });
  return NextResponse.json({ id: quote.id, reference: quote.reference, estimateTotal }, { status: 201 });
}
