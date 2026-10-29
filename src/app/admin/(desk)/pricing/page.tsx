import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPricing } from "@/lib/settings";
import { PricingForm } from "./PricingForm";
import { ZonesTable } from "./ZonesTable";

export const dynamic = "force-dynamic";

export default async function PricingAdmin() {
  const [pricing, zones, session] = await Promise.all([
    getPricing(),
    prisma.zone.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getSession(),
  ]);
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Yard</p><h2>Pricing</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.4rem" }}>Machine costs move with the dollar. Choose whether the public site shows indicative GH₵ rates and a live estimate, or asks customers to call for today&apos;s rate, and keep the review date current so customers know the figures are looked after. Per-machine rates are edited under Fleet &amp; rates; the hire rules and low bed zones below feed the rate table, the customer&apos;s estimate and the staff calculator.</p>
      <PricingForm pricing={pricing} />

      <h3 style={{ margin: "2.4rem 0 .4rem" }}>Low bed zones</h3>
      <p className="hint" style={{ margin: "0 0 1rem", maxWidth: "70ch" }}>Road distance from the N1 yard decides the transport line: the estimator charges the zone price twice (deliver and collect). Sites beyond the last zone are priced per km in the calculator and quoted by dispatch. Zones are never deleted because old quotes refer to them; deactivate one instead.</p>
      <ZonesTable zones={zones} isSuper={session?.role === "superadmin"} />
    </>
  );
}
