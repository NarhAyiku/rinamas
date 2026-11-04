import { cache } from "react";
import { prisma } from "./db";
import { getPricing } from "./settings";
import { buildRateTable, loadZones } from "./rates";
import { whatsappNumber } from "./contact";
import type { MachineCard } from "@/components/Fleet";

/** Everything the public pages read: visible machines, pricing, zones, and the browser-safe cards and rate table.
 *  Cached per request so the page, its metadata and its JSON-LD share one set of queries. */
export const loadPublic = cache(async () => {
  const [machines, pricing, zones] = await Promise.all([
    prisma.machine.findMany({ where: { hidden: false }, orderBy: [{ available: "desc" }, { sortOrder: "asc" }] }),
    getPricing(),
    loadZones(),
  ]);
  // Only what the cards and pop-up need goes to the browser; with prices hidden no rate leaves the server.
  const cards: MachineCard[] = machines.map((m) => ({
    id: m.id, slug: m.slug, name: m.name, category: m.category, categoryLabel: m.categoryLabel, image: m.image, specs: m.specs,
    rateUnit: m.rateUnit, available: m.available, priceOnRequest: m.priceOnRequest, selfDrive: m.selfDrive,
    dayRate: pricing.showPrices ? m.dayRate : 0, operatorRate: pricing.showPrices ? m.operatorRate : null,
  }));
  return { machines, pricing, zones, cards, rates: buildRateTable(machines, zones, pricing), wa: whatsappNumber() };
});

/** True when this machine's rate may be published (site shows prices and the machine isn't quote-only). */
export const priceShown = (showPrices: boolean, m: { priceOnRequest: boolean }) => showPrices && !m.priceOnRequest;
