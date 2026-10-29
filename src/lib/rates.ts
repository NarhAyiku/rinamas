import { prisma } from "./db";
import type { Pricing } from "./settings";
import { rulesOf } from "./settings";
import type { RateMachine, RateTable, RateZone } from "./pricing";

/** Any object with the machine columns the engine needs (a Prisma Machine row fits). */
export type MachineLike = { id: string; name: string; dayRate: number; rateUnit: string; operatorRate: number | null; fuelLPerDay: number | null; selfDrive: boolean; priceOnRequest: boolean };
export type ZoneLike = { id: string; name: string; label: string; towns: string; maxKm: number; lowBedEachWay: number };

/** Active transport zones in display order. */
export const loadZones = () => prisma.zone.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });

export const toRateZone = (z: ZoneLike): RateZone => ({ id: z.id, name: z.name, label: z.label, towns: z.towns, maxKm: z.maxKm, lowBedEachWay: z.lowBedEachWay });

export const toRateMachine = (m: MachineLike): RateMachine => ({
  id: m.id, name: m.name, dayRate: m.dayRate, rateUnit: m.rateUnit, operatorRate: m.operatorRate,
  fuelLPerDay: m.fuelLPerDay, selfDrive: m.selfDrive, priceOnRequest: m.priceOnRequest,
});

/**
 * Serialisable rate table for the public quote form. When prices are hidden every GH₵ figure is
 * stripped so the browser never sees a rate; the form then says "Call dispatch for today's rate".
 */
export function buildRateTable(machines: MachineLike[], zones: ZoneLike[], pricing: Pricing): RateTable {
  const rules = rulesOf(pricing);
  const show = pricing.showPrices;
  return {
    machines: machines.map((m) => ({ ...toRateMachine(m), ...(show ? {} : { dayRate: 0, operatorRate: null, fuelLPerDay: null }) })),
    zones: zones.map((z) => ({ ...toRateZone(z), ...(show ? {} : { lowBedEachWay: 0 }) })),
    rules: show ? rules : { ...rules, dieselPrice: null, perKmBeyond: 0 },
    reviewedAt: pricing.reviewedAt,
    usdRate: pricing.usdRate,
    showPrices: show,
  };
}
