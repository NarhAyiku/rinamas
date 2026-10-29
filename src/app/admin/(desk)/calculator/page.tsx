import { prisma } from "@/lib/db";
import { getPricing, rulesOf } from "@/lib/settings";
import { loadZones, toRateMachine, toRateZone } from "@/lib/rates";
import { Calculator } from "./Calculator";

export const dynamic = "force-dynamic";

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [machines, zones, pricing, requests] = await Promise.all([
    prisma.machine.findMany({ orderBy: { sortOrder: "asc" } }),
    loadZones(),
    getPricing(),
    prisma.quoteRequest.findMany({
      where: { status: { in: ["new", "quoted"] } }, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, reference: true, name: true, machineName: true, machineId: true, days: true, duration: true, zoneId: true, operator: true, fuel: true, site: true, status: true },
    }),
  ]);
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Dispatch desk</p><h2>Quote calculator</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.4rem" }}>The same engine customers see on the site, with distance in km and low bed trips for jobs the zones do not cover. Work it out while the customer is on the phone, copy the breakdown to WhatsApp, or apply it to an open request as the quote.</p>
      <Calculator
        machines={machines.map(toRateMachine)}
        zones={zones.map(toRateZone)}
        rules={rulesOf(pricing)}
        reviewedAt={pricing.reviewedAt}
        usdRate={pricing.usdRate}
        requests={requests}
        initial={{ machineId: sp.machine ?? "", days: sp.days ?? "", zoneId: sp.zone ?? "", operator: sp.operator ?? "", fuel: sp.fuel ?? "", requestId: sp.request ?? "", km: sp.km ?? "" }}
      />
    </>
  );
}
