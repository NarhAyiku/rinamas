import { getPricing } from "@/lib/settings";
import { PricingForm } from "./PricingForm";

export const dynamic = "force-dynamic";

export default async function PricingAdmin() {
  const pricing = await getPricing();
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Yard</p><h2>Pricing display</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.4rem" }}>Machine costs move with the dollar. Choose whether the public site shows indicative GH₵ rates or asks customers to call for today's rate, and keep the review date current so customers know the figures are looked after. Per-machine rates are edited under Fleet &amp; rates.</p>
      <PricingForm pricing={pricing} />
    </>
  );
}
