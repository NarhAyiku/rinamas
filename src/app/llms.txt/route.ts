// A plain-text brief on RINAMAS for AI assistants (Meta AI, ChatGPT, Gemini, Copilot), per the llms.txt convention.
// Built from the live fleet and the shared data, so it says what the site says. Rates appear only when the site shows them.
import { REGIONS, regionLabel } from "@/data/regions";
import { faqItems } from "@/data/faq";
import { ghs, parseSpecs } from "@/lib/format";
import { ladder } from "@/lib/pricing";
import { loadPublic, priceShown } from "@/lib/public-data";
import { abs, hireTitle } from "@/lib/seo";
import { ADDRESS, BUSINESS_NAME, CEO, DISPATCH_PHONE, HOURS, MAPS_URL, OFFICE_PHONE, SOCIAL } from "@/lib/contact";

export const dynamic = "force-dynamic";

export async function GET() {
  const { machines, pricing, zones } = await loadPublic();
  const rate = (m: (typeof machines)[number]) => {
    if (!priceShown(pricing.showPrices, m)) return "rate on request (dispatch sends today's rate the same working day)";
    if (m.rateUnit === "trip") return `from ${ghs(m.dayRate)} per trip in Greater Accra`;
    const l = ladder(m.dayRate, pricing);
    return `${ghs(l.day)} per ${pricing.dayHours}-hour day, ${ghs(l.week)} per week, ${ghs(l.month)} per month, machine only${m.operatorRate ? `; operator ${ghs(m.operatorRate)} per day` : "; operator included"}`;
  };
  const social = Object.entries(SOCIAL).filter(([, v]) => v);

  const text = [
    `# ${BUSINESS_NAME}`,
    "",
    `> Heavy-machine hire, haulage and operators across Ghana, from a yard off the N1 Highway in Accra. Excavators, backhoe loaders, bulldozers, wheel loaders, graders, rollers, tipper trucks, low beds, cranes and telehandlers, by the day, week or month, with or without an operator.`,
    "",
    "## Contact",
    `- Dispatch (call or WhatsApp): ${DISPATCH_PHONE.tel}`,
    `- Office: ${OFFICE_PHONE.tel}`,
    `- Yard: ${ADDRESS.street}, ${ADDRESS.locality}, Ghana (${MAPS_URL})`,
    `- Hours: ${HOURS.label}. The dispatch line answers Sundays for machines already on hire.`,
    `- Request a quote online: ${abs("/#quote")}`,
    `- CEO: ${CEO}`,
    ...social.map(([k, v]) => `- ${k[0].toUpperCase()}${k.slice(1)}: ${v}`),
    "",
    "## How hire works",
    "1. Send the machine, dates and site, and say whether you want an operator and fuel (form, call or WhatsApp).",
    "2. A written quote comes back within the working day. A deposit by MTN MoMo or bank transfer holds the machine and date, and the quoted rate is locked for the hire.",
    "3. RINAMAS delivers on its own low bed: Greater Accra usually within 24 hours, other regions within 48.",
    `4. Hours come off the machine's meter and the site agent signs them daily; a day is ${pricing.dayHours} metered hours.`,
    `Longer hires cost less per day: a week is ${pricing.weekDays} days at ${pricing.weekDiscountPct}% off and a month is ${pricing.monthDays} days at ${pricing.monthDiscountPct}% off.`,
    "",
    "## Machines",
    ...machines.map((m) => {
      const specs = parseSpecs(m.specs).map(([k, v]) => `${k}: ${v}`).join("; ");
      return `- [${hireTitle(m.name)}](${abs(`/hire/${m.slug}`)}): ${m.categoryLabel}. ${specs}. ${rate(m)}.${m.available ? "" : " Currently out on hire; ask for dates."}`;
    }),
    "",
    "## Delivery and regions",
    pricing.showPrices && zones.length
      ? `Low-bed transport from the N1 yard, each way: ${zones.map((z) => `Zone ${z.name} (${z.label.toLowerCase()}: ${z.towns}) ${ghs(z.lowBedEachWay)}`).join("; ")}; beyond ${zones[zones.length - 1].maxKm} km, ${ghs(pricing.perKmBeyond)} per km, quoted.`
      : "Low-bed transport is priced by zone around Accra and by distance beyond it, shown as its own line on every quote.",
    ...REGIONS.map((r) => `- [${regionLabel(r)}](${abs(`/regions/${r.slug}`)}): ${r.towns.join(", ")}. Delivery ${r.delivery}.`),
    "",
    "## Questions",
    ...faqItems(pricing).flatMap((f) => [`### ${f.q}`, f.a, ""]),
  ].join("\n");

  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600" } });
}
