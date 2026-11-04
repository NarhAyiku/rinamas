// Creating a hire request from the public site. Shared by the quote form (POST /api/quotes) and the chat assistant,
// so both validate the same way and the estimate is always recomputed here from the database: nothing priced in the
// browser or by the model is trusted or stored.
import { z } from "zod";
import { prisma } from "./db";
import { makeReference } from "./format";
import { getPricing, rulesOf } from "./settings";
import { toRateMachine, toRateZone } from "./rates";
import { daysFromDuration, durationLabel, estimate } from "./pricing";

export const hireRequestSchema = z.object({
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

export type HireRequestSource = "form" | "chat";
export type HireRequestResult = { ok: true; id: string; reference: string; estimateTotal: number | null } | { ok: false; error: string };

export async function createHireRequest(body: unknown, source: HireRequestSource): Promise<HireRequestResult> {
  const parsed = hireRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const pricing = await getPricing();
  const days = d.days ?? daysFromDuration(d.duration, rulesOf(pricing));
  if (!days) return { ok: false, error: "How many days do you need the machine?" };

  const [machine, zone] = await Promise.all([
    d.machineId === "other" ? null : prisma.machine.findUnique({ where: { id: d.machineId } }),
    d.zoneId ? prisma.zone.findUnique({ where: { id: d.zoneId } }) : null,
  ]);
  if (d.machineId !== "other" && !machine) return { ok: false, error: "That machine is no longer listed. Pick another." };
  if (d.zoneId && !zone) return { ok: false, error: "That zone is no longer listed. Pick again." };

  let estimateTotal: number | null = null, estimateJson: string | null = null;
  if (machine && pricing.showPrices && !machine.priceOnRequest) {
    const rules = rulesOf(pricing);
    const est = estimate({ machine: toRateMachine(machine), days, zone: zone ? toRateZone(zone) : null, operator: d.operator === "with", fuel: d.fuel === "with", rules });
    if (est.ok) {
      estimateTotal = est.total;
      estimateJson = JSON.stringify({
        ...est, machineId: machine.id, machineName: machine.name, zone: zone ? { id: zone.id, name: zone.name, label: zone.label, towns: zone.towns } : null,
        km: null, trips: null, operator: d.operator === "with", fuel: d.fuel === "with", rules, reviewedAt: pricing.reviewedAt, usdRate: pricing.usdRate,
        computedAt: new Date().toISOString(), source: source === "chat" ? "chat" : "site",
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
      notes: d.notes || null, source,
    },
  });
  return { ok: true, id: quote.id, reference: quote.reference, estimateTotal };
}
