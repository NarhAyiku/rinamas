import { prisma } from "./db";

export type Pricing = {
  showPrices: boolean;      // true: show indicative GH₵ rates; false: "price on request"
  note: string;             // shown under the fleet and in the rate section
  reviewedAt: string | null; // YYYY-MM-DD the rates were last reviewed
  usdRate: string | null;   // GH₵ per USD assumed at that review, optional
};

export const PRICING_DEFAULTS: Pricing = {
  showPrices: true,
  note: "Rates shown are indicative GH₵ day rates for an 8-hour shift, machine only; operator, fuel, low-bed mobilisation and standby are charged separately. Because our machines, parts and finance are dollar-based we review the rate card regularly, confirm the final rate in writing when you book, and that quoted rate is then fixed for your hire period.",
  reviewedAt: null,
  usdRate: null,
};

const KEYS = { showPrices: "pricing.showPrices", note: "pricing.note", reviewedAt: "pricing.reviewedAt", usdRate: "pricing.usdRate" } as const;

export async function getPricing(): Promise<Pricing> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const v = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    showPrices: v(KEYS.showPrices) == null ? PRICING_DEFAULTS.showPrices : v(KEYS.showPrices) === "true",
    note: v(KEYS.note) ?? PRICING_DEFAULTS.note,
    reviewedAt: v(KEYS.reviewedAt) || null,
    usdRate: v(KEYS.usdRate) || null,
  };
}

export async function setPricing(p: Pricing) {
  const entries: [string, string][] = [
    [KEYS.showPrices, String(p.showPrices)], [KEYS.note, p.note], [KEYS.reviewedAt, p.reviewedAt ?? ""], [KEYS.usdRate, p.usdRate ?? ""],
  ];
  await prisma.$transaction(entries.map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })));
}

export const fmtReviewed = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
