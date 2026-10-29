"use client";
import { useActionState } from "react";
import { savePricing } from "@/app/admin/actions";
import type { Pricing } from "@/lib/settings";

export function PricingForm({ pricing }: { pricing: Pricing }) {
  const [state, action, pending] = useActionState(savePricing, undefined);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="panel" style={{ display: "grid", gap: "1rem", maxWidth: 860 }}>
      <div className="radio" role="radiogroup" aria-label="How prices appear on the site">
        <span>On the site</span>
        <label><input type="radio" name="showPrices" value="true" defaultChecked={pricing.showPrices} /> Show indicative rates and the live estimate</label>
        <label><input type="radio" name="showPrices" value="false" defaultChecked={!pricing.showPrices} /> Hide rates, show "price on request"</label>
      </div>
      <label className="f">Pricing note shown to customers<textarea name="note" rows={4} defaultValue={pricing.note} maxLength={600} /></label>
      <div className="inline-form">
        <label className="f">Rates last reviewed on<input name="reviewedAt" type="date" defaultValue={pricing.reviewedAt ?? ""} max={today} /></label>
        <label className="f">GH₵ per US$ used (optional)<input name="usdRate" type="number" step="0.01" min={0} defaultValue={pricing.usdRate ?? ""} placeholder="e.g. 11.63" /></label>
      </div>

      <h3 style={{ marginBottom: 0 }}>Hire rules</h3>
      <p className="hint" style={{ margin: 0 }}>These drive the rate table, the customer&apos;s live estimate and the staff calculator. A week and a month are discounted bundles of days; the estimator picks whichever mix is cheapest.</p>
      <div className="inline-form rules-grid">
        <label className="f">Hours in a day<input name="dayHours" type="number" min={1} max={24} defaultValue={pricing.dayHours} required /></label>
        <label className="f">Minimum hire (days)<input name="minDays" type="number" min={1} max={30} defaultValue={pricing.minDays} required /></label>
        <label className="f">Days in a week<input name="weekDays" type="number" min={1} max={7} defaultValue={pricing.weekDays} required /></label>
        <label className="f">Week discount %<input name="weekDiscountPct" type="number" min={0} max={90} step="0.5" defaultValue={pricing.weekDiscountPct} required /></label>
        <label className="f">Days in a month<input name="monthDays" type="number" min={1} max={31} defaultValue={pricing.monthDays} required /></label>
        <label className="f">Month discount %<input name="monthDiscountPct" type="number" min={0} max={90} step="0.5" defaultValue={pricing.monthDiscountPct} required /></label>
        <label className="f">Standby day, % of day rate<input name="standbyPct" type="number" min={0} max={100} defaultValue={pricing.standbyPct} required /></label>
        <label className="f">Deposit, % of total<input name="depositPct" type="number" min={0} max={100} defaultValue={pricing.depositPct} required /></label>
      </div>

      <h3 style={{ marginBottom: 0 }}>Fuel, transport and VAT</h3>
      <div className="inline-form rules-grid">
        <label className="f">Diesel GH₵ per litre (blank = metered)<input name="dieselPrice" type="number" min={0} step="0.01" defaultValue={pricing.dieselPrice ?? ""} placeholder="e.g. 13.50" /></label>
        <label className="f">Low bed GH₵ per km beyond zones<input name="perKmBeyond" type="number" min={0} step="0.5" defaultValue={pricing.perKmBeyond} required /></label>
        <label className="f">VAT % (0 = off)<input name="vatPct" type="number" min={0} max={50} step="0.5" defaultValue={pricing.vatPct} required /></label>
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center", alignSelf: "end", paddingBottom: ".6rem", whiteSpace: "nowrap", fontSize: ".95rem" }}><input type="checkbox" name="vatIncluded" defaultChecked={pricing.vatIncluded} /> Rates include VAT</label>
      </div>
      <p className="hint" style={{ margin: 0 }}>Leave diesel blank and estimates say "diesel billed on metered litres". Keep VAT at 0 until RINAMAS is VAT registered.</p>

      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      <div className="row-form">
        <button className="btn btn-accent btn-sm" type="submit" disabled={pending}>{pending ? "Saving…" : "Save pricing"}</button>
        <span className="hint" style={{ margin: 0 }}>Changes show on the public site immediately.</span>
      </div>
    </form>
  );
}
