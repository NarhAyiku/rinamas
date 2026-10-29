import { prisma } from "./db";
import { DEFAULT_RULES, type Rules } from "./pricing";

/** Everything under the `pricing.*` Setting namespace: display choices plus the estimator's rule scalars. */
export type Pricing = Rules & {
  showPrices: boolean;      // true: show indicative GH₵ rates; false: "price on request"
  note: string;             // shown under the fleet and in the rate section
  reviewedAt: string | null; // YYYY-MM-DD the rates were last reviewed
  usdRate: string | null;   // GH₵ per USD assumed at that review, optional
};

export const PRICING_DEFAULTS: Pricing = {
  ...DEFAULT_RULES,
  showPrices: true,
  note: "Rates shown are indicative GH₵ day rates for an 8-hour shift, machine only; operator, fuel, low-bed mobilisation and standby are charged separately. Because our machines, parts and finance are dollar-based we review the rate card regularly, confirm the final rate in writing when you book, and that quoted rate is then fixed for your hire period.",
  reviewedAt: null,
  usdRate: null,
};

const PREFIX = "pricing.";
const NUMBER_KEYS = ["dayHours", "minDays", "weekDays", "weekDiscountPct", "monthDays", "monthDiscountPct", "perKmBeyond", "vatPct", "standbyPct", "depositPct"] as const;

/** The rule scalars only, for the engine. */
export function rulesOf(p: Pricing): Rules {
  return {
    dayHours: p.dayHours, minDays: p.minDays, weekDays: p.weekDays, weekDiscountPct: p.weekDiscountPct, monthDays: p.monthDays, monthDiscountPct: p.monthDiscountPct,
    dieselPrice: p.dieselPrice, perKmBeyond: p.perKmBeyond, vatPct: p.vatPct, vatIncluded: p.vatIncluded, standbyPct: p.standbyPct, depositPct: p.depositPct,
  };
}

export async function getPricing(): Promise<Pricing> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
  const v = (k: string) => rows.find((r) => r.key === PREFIX + k)?.value;
  const num = (k: (typeof NUMBER_KEYS)[number]) => { const s = v(k); const n = s == null || s === "" ? NaN : Number(s); return Number.isFinite(n) ? n : PRICING_DEFAULTS[k]; };
  const diesel = v("dieselPrice");
  const dieselN = diesel == null || diesel === "" ? NaN : Number(diesel);
  return {
    showPrices: v("showPrices") == null ? PRICING_DEFAULTS.showPrices : v("showPrices") === "true",
    note: v("note") ?? PRICING_DEFAULTS.note,
    reviewedAt: v("reviewedAt") || null,
    usdRate: v("usdRate") || null,
    dayHours: num("dayHours"), minDays: num("minDays"), weekDays: num("weekDays"), weekDiscountPct: num("weekDiscountPct"),
    monthDays: num("monthDays"), monthDiscountPct: num("monthDiscountPct"),
    dieselPrice: Number.isFinite(dieselN) && dieselN > 0 ? dieselN : null,
    perKmBeyond: num("perKmBeyond"), vatPct: num("vatPct"),
    vatIncluded: v("vatIncluded") == null ? PRICING_DEFAULTS.vatIncluded : v("vatIncluded") === "true",
    standbyPct: num("standbyPct"), depositPct: num("depositPct"),
  };
}

export async function setPricing(p: Pricing) {
  const entries: [string, string][] = [
    ["showPrices", String(p.showPrices)], ["note", p.note], ["reviewedAt", p.reviewedAt ?? ""], ["usdRate", p.usdRate ?? ""],
    ...NUMBER_KEYS.map((k): [string, string] => [k, String(p[k])]),
    ["dieselPrice", p.dieselPrice == null ? "" : String(p.dieselPrice)],
    ["vatIncluded", String(p.vatIncluded)],
  ];
  await prisma.$transaction(entries.map(([k, value]) => { const key = PREFIX + k; return prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }); }));
}

export const fmtReviewed = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
