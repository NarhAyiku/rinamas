"use client";
import { useActionState } from "react";
import { savePricing } from "@/app/admin/actions";
import type { Pricing } from "@/lib/settings";

export function PricingForm({ pricing }: { pricing: Pricing }) {
  const [state, action, pending] = useActionState(savePricing, undefined);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="panel" style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
      <div className="radio" role="radiogroup" aria-label="How prices appear on the site">
        <span>On the site</span>
        <label><input type="radio" name="showPrices" value="true" defaultChecked={pricing.showPrices} /> Show indicative rates with "from GH₵ …"</label>
        <label><input type="radio" name="showPrices" value="false" defaultChecked={!pricing.showPrices} /> Hide rates, show "price on request"</label>
      </div>
      <label className="f">Pricing note shown to customers<textarea name="note" rows={4} defaultValue={pricing.note} maxLength={600} /></label>
      <div className="inline-form">
        <label className="f">Rates last reviewed on<input name="reviewedAt" type="date" defaultValue={pricing.reviewedAt ?? ""} max={today} /></label>
        <label className="f">GH₵ per US$ used (optional)<input name="usdRate" type="number" step="0.01" min={0} defaultValue={pricing.usdRate ?? ""} placeholder="e.g. 15.20" /></label>
      </div>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      <div className="row-form">
        <button className="btn btn-accent btn-sm" type="submit" disabled={pending}>{pending ? "Saving…" : "Save pricing display"}</button>
        <span className="hint" style={{ margin: 0 }}>Changes show on the public site immediately.</span>
      </div>
    </form>
  );
}
