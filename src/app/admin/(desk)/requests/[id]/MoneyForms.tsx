"use client";
import { useActionState } from "react";
import { recordPayment, setFinalBill } from "@/app/admin/actions";
import { PAYMENT_KINDS, PAYMENT_METHODS } from "@/lib/settle";

/** Record money received (or refunded) against the hire. */
export function PaymentForm({ quoteId, suggestKind, suggestAmount }: { quoteId: string; suggestKind: keyof typeof PAYMENT_KINDS; suggestAmount: number | null }) {
  const [st, action, pending] = useActionState(recordPayment, undefined);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} style={{ display: "grid", gap: ".8rem", marginTop: "1rem" }}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <div className="inline-form">
        <label className="f">Payment<select name="kind" defaultValue={suggestKind}>{Object.entries(PAYMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="f">Amount (GH₵)<input name="amount" type="number" min={1} step={1} defaultValue={suggestAmount && suggestAmount > 0 ? suggestAmount : ""} required /></label>
        <label className="f">Method<select name="method" defaultValue="momo">{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="f">Paid on<input name="paidAt" type="date" max={today} defaultValue={today} required /></label>
        <label className="f">Reference<input name="reference" placeholder="MoMo ID, cheque no." /></label>
      </div>
      <label className="f">Note<input name="note" placeholder="Who paid, anything agreed" /></label>
      {st?.error && <p className="err" role="alert">{st.error}</p>}
      {st?.ok && <p className="ok" role="status">{st.ok}</p>}
      <div><button className="btn btn-accent btn-sm" type="submit" disabled={pending}>{pending ? "Saving…" : "Record payment"}</button></div>
    </form>
  );
}

/** Apply the settlement as the final bill, or type one in. */
export function FinalBillForm({ id, canSettle, settleTotal, current }: { id: string; canSettle: boolean; settleTotal: number | null; current: number | null }) {
  const [st, action, pending] = useActionState(setFinalBill, undefined);
  return (
    <div style={{ display: "grid", gap: ".8rem", marginTop: ".9rem" }}>
      {canSettle && settleTotal != null && (
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="mode" value="settlement" />
          <button className="btn btn-accent btn-sm" type="submit" disabled={pending || current === settleTotal}>
            {current === settleTotal ? "Final bill matches the settlement" : `Use GH₵ ${settleTotal.toLocaleString("en-GH")} as the final bill`}
          </button>
        </form>
      )}
      <form action={action} className="inline-form">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="mode" value="manual" />
        <label className="f">Final bill (GH₵)<input name="finalAmount" type="number" min={0} step={1} defaultValue={current ?? ""} required /></label>
        <label className="f" style={{ gridColumn: "span 2" }}>Reason{current != null ? " (needed to change it)" : ""}<input name="reason" placeholder="e.g. agreed discount, extra trip, damage charge" /></label>
        <button className="btn btn-ghost btn-sm" type="submit" disabled={pending}>{pending ? "Saving…" : current != null ? "Change final bill" : "Set final bill"}</button>
      </form>
      {st?.error && <p className="err" role="alert">{st.error}</p>}
      {st?.ok && <p className="ok" role="status">{st.ok}</p>}
    </div>
  );
}
