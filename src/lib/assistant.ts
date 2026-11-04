// "Ask RINAMAS": the website chat assistant. Answers from the live fleet, pricing and zones, and can file a hire request
// through the same createHireRequest the quote form uses. The customer must tap "Send request" first (tool approval),
// so the model can never file a request on its own. Nothing about the chat itself is stored.
import { tool } from "ai";
import { z } from "zod";
import { REGIONS, regionLabel } from "@/data/regions";
import { faqItems } from "@/data/faq";
import { ghs, parseSpecs } from "./format";
import { estimate, ladder } from "./pricing";
import { rulesOf } from "./settings";
import { toRateMachine, toRateZone } from "./rates";
import { createHireRequest } from "./hire-request";
import type { loadPublic } from "./public-data";
import { BUSINESS_NAME, CEO, DISPATCH_PHONE, HOURS, OFFICE_PHONE } from "./contact";

/** Groq model. Fast and cheap, with reliable tool calling. Check console.groq.com/docs/models before changing. */
export const ASSISTANT_MODEL = "openai/gpt-oss-120b";

export const assistantEnabled = () => Boolean(process.env.GROQ_API_KEY);

type PublicData = Awaited<ReturnType<typeof loadPublic>>;

const todayInAccra = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" }); // YYYY-MM-DD
const weekdayInAccra = () => new Date().toLocaleDateString("en-GB", { timeZone: "Africa/Accra", weekday: "long" });

export function assistantInstructions({ machines, pricing, zones }: PublicData) {
  const show = pricing.showPrices;
  const fleet = machines.map((m) => {
    const specs = parseSpecs(m.specs).map(([k, v]) => `${k} ${v}`).join("; ");
    let rate = "rate on request";
    if (show && !m.priceOnRequest) {
      if (m.rateUnit === "trip") rate = `${ghs(m.dayRate)} per trip in Greater Accra`;
      else { const l = ladder(m.dayRate, pricing); rate = `${ghs(l.day)}/day, ${ghs(l.week)}/week, ${ghs(l.month)}/month, machine only; operator ${m.operatorRate ? `${ghs(m.operatorRate)}/day extra` : "included"}`; }
    }
    return `- ${m.name} [slug: ${m.slug}] (${m.categoryLabel}). ${specs}. ${rate}. ${m.available ? "On the yard." : "Out on hire now; can be booked for later dates."}${m.selfDrive ? " Drives itself to site (no low-bed charge)." : ""}`;
  }).join("\n");
  const zoneText = zones.map((z) => `- Zone ${z.name}: ${z.label.toLowerCase()} (${z.towns})${show ? `, low bed ${ghs(z.lowBedEachWay)} each way` : ""}`).join("\n");
  const faq = faqItems(pricing).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n");

  return `You are "Ask RINAMAS", the website assistant for ${BUSINESS_NAME}, a heavy-machine hire company with a yard off the N1 Highway (George Walker Bush Motorway) in Accra, Ghana. You help contractors, developers and site owners pick a machine, understand the price, and send a hire request to dispatch.

Today is ${weekdayInAccra()} ${todayInAccra()} (Accra time).

STYLE
- Write like an experienced RINAMAS dispatcher replying on WhatsApp: short, warm, direct, plain words. 1 to 3 sentences, or a short list with "- " bullets.
- Plain text only: no markdown, no ** or #, no emoji. Never use en dashes or em dashes (– or —); use a comma, a full stop or the word "to" ("Mon to Sat", "20 to 22 T"). Hyphens only inside words like "low-bed".
- No filler or chatbot phrases: never start with "Sure!", "Great question", "Absolutely", "Certainly" or "I'd be happy to". Don't say you are an AI or a language model unless the customer asks directly; if they do, say you're RINAMAS's automatic assistant and dispatch can take over any time.
- Cedi amounts as "GH₵ 8,500".
- Reply in the language the customer writes in (English, Twi, Ga, Ewe, Pidgin) if you can; otherwise English.
- Never invent machines, prices, dates, discounts, availability or policies. Use only the facts below and the tools.
- If unsure, or the question is outside machine hire, say so and point to dispatch: call or WhatsApp ${DISPATCH_PHONE.display}.
- If someone wants the boss, the CEO, a manager or the office, give the office line ${OFFICE_PHONE.display} (the CEO is ${CEO}); for hires and machines on site, dispatch ${DISPATCH_PHONE.display}.

PRICES
${show
    ? `- Prices are guide figures in Ghana cedis. A day is ${pricing.dayHours} metered hours. A week is ${pricing.weekDays} days at ${pricing.weekDiscountPct}% off; a month is ${pricing.monthDays} days at ${pricing.monthDiscountPct}% off; the customer always gets whichever is cheaper.
- A RINAMAS week is ${pricing.weekDays} working days and a month is ${pricing.monthDays}, so "2 weeks" means ${pricing.weekDays * 2} days and "a month" means ${pricing.monthDays} days. Use those day counts in tools.
- For a full price (transport, operator, fuel), call estimateHire. Never add numbers up yourself, and describe how the hire is charged using the tool's "basis" words as they are (e.g. "2 weeks + 2 days"). Say it's an estimate and the written quote confirms it, and that the accepted rate is locked for the hire.`
    : `- The site does not publish rates. Never state or guess any price. Say dispatch sends today's rate in a written quote the same working day, and offer to send a request or have them call ${DISPATCH_PHONE.display}.`}

MACHINES ON THE YARD
${fleet}

DELIVERY
Tracked machines go on RINAMAS's low bed from the N1 yard, priced by zone:
${zoneText}
- Further than the last zone: quoted by road distance${show ? ` (${ghs(pricing.perKmBeyond)} per km beyond the last zone)` : ""}.
- Usually within 24 hours in Greater Accra, 48 hours elsewhere.
Regions served: ${REGIONS.map((r) => `${regionLabel(r)} (${r.towns.slice(0, 3).join(", ")})`).join("; ")}.

POLICIES AND FAQ
${faq}
- Hours: ${HOURS.label}. Dispatch ${DISPATCH_PHONE.display} (call or WhatsApp), office ${OFFICE_PHONE.display}.
- Mining: only licensed operations with Minerals Commission papers. Politely refuse anything that sounds like galamsey or unlicensed mining, and don't help work around it.

SENDING A HIRE REQUEST
- When the customer wants to book or get a written quote, collect: machine, start date, number of days, site location (town and area), with or without operator, with or without fuel, their name and phone number. Optional: notes about the job.
- Ask for missing details a couple at a time, not all at once. Turn relative dates ("next Monday") into a YYYY-MM-DD date after today, and weeks or months into days as above.
- Notes are only for what the job is (ground, access, what the machine will do); don't repeat the site or other fields there.
- Then call submitHireRequest. The customer sees the details and taps "Send request" to confirm; do not ask them to type "yes" first. If they decline, ask what to change.
- After it is sent, give them the reference number and say dispatch will call or WhatsApp them with a written quote the same working day.
- Don't call submitHireRequest again for the same job unless they ask to change something.`;
}

export function assistantTools({ machines, pricing, zones }: PublicData) {
  const bySlug = (s: string) => machines.find((m) => m.slug === s);
  const zoneBy = (name?: string | null) => (name ? zones.find((z) => z.name.toLowerCase() === name.trim().toLowerCase()) : undefined);
  const zoneNames = zones.map((z) => z.name);

  const submitHireRequest = tool({
    description: "File a hire request with RINAMAS dispatch. The customer reviews the details and confirms before it is sent.",
    inputSchema: z.object({
      machineSlug: z.string().describe(`Machine slug from the list, or "other" for something not listed`),
      startDate: z.string().describe("Start date, YYYY-MM-DD"),
      days: z.number().int().min(1).max(365).describe("Number of working days"),
      site: z.string().describe("Site location: town and area"),
      zone: z.string().nullable().describe(`Delivery zone name (${zoneNames.join(", ")}) if the site is clearly in one, else null`),
      operator: z.enum(["with", "without"]),
      fuel: z.enum(["with", "without"]),
      name: z.string().describe("Customer's name"),
      phone: z.string().describe("Customer's phone number"),
      notes: z.string().nullable().describe("What the job is, ground, access; null if nothing"),
    }),
    execute: async (i) => {
      const machine = i.machineSlug === "other" ? null : bySlug(i.machineSlug);
      if (i.machineSlug !== "other" && !machine) return { ok: false as const, error: `No machine with slug ${i.machineSlug}` };
      const r = await createHireRequest({
        machineId: machine?.id ?? "other", startDate: i.startDate, days: i.days, site: i.site, zoneId: zoneBy(i.zone)?.id ?? "",
        operator: i.operator, fuel: i.fuel, name: i.name, phone: i.phone, notes: ["Via website chat.", i.notes].filter(Boolean).join(" "),
      }, "chat");
      if (!r.ok) return { ok: false as const, error: r.error };
      return { ok: true as const, reference: r.reference, estimateTotal: pricing.showPrices ? r.estimateTotal : null };
    },
  });

  const estimateHire = tool({
    description: "Itemised price estimate for one machine: hire, low-bed transport, operator and fuel, with the total and deposit.",
    inputSchema: z.object({
      machineSlug: z.string(),
      days: z.number().int().min(1).max(365),
      zone: z.string().nullable().describe(`Delivery zone name (${zoneNames.join(", ")}) or null if unknown / further away`),
      operator: z.boolean(),
      fuel: z.boolean(),
    }),
    execute: async (i) => {
      if (!pricing.showPrices) return { ok: false, reason: "Rates come from dispatch in a written quote" };
      const m = bySlug(i.machineSlug);
      if (!m) return { ok: false, reason: `No machine with slug ${i.machineSlug}` };
      if (m.priceOnRequest) return { ok: false, reason: "This machine is quoted per job after a site call" };
      const z = zoneBy(i.zone);
      const est = estimate({ machine: toRateMachine(m), days: i.days, zone: z ? toRateZone(z) : null, operator: i.operator, fuel: i.fuel, rules: rulesOf(pricing) });
      if (!est.ok) return est;
      return {
        ok: true, machine: m.name, basis: est.basis, zone: z ? `Zone ${z.name}` : "transport to be quoted by distance",
        lines: est.lines.map((l) => ({ item: l.label, detail: l.detail, amount: ghs(l.amount) })),
        vat: est.vat ? ghs(est.vat) : null, total: ghs(est.total), deposit: ghs(est.deposit), notes: est.notes,
      };
    },
  });

  return { submitHireRequest, estimateHire };
}

export type AssistantTools = ReturnType<typeof assistantTools>;

/** With prices hidden the model is not offered the pricing tool at all, so it cannot leak a rate. */
export const activeAssistantTools = (showPrices: boolean): (keyof AssistantTools)[] =>
  showPrices ? ["submitHireRequest", "estimateHire"] : ["submitHireRequest"];
