import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate, ghs, intl, waLink } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { getPricing, rulesOf } from "@/lib/settings";
import { QuoteStatusForm, StatusPill, Timeline } from "@/components/StatusBits";
import { addHourLog, deleteHourLog, deletePayment, saveHire } from "@/app/admin/actions";
import { parseSnapshot, settlementFor } from "@/lib/money";
import { PAYMENT_KINDS, PAYMENT_METHODS, balanceOf, billOf, paidTotal } from "@/lib/settle";
import { FinalBillForm, PaymentForm } from "./MoneyForms";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  "close-needs-bill": "Set the final bill below before closing this job. Closing without one leaves the money out of the books.",
};

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [session, q, pricing] = await Promise.all([
    getSession(),
    prisma.quoteRequest.findUnique({ where: { id }, include: { hourLogs: { orderBy: { date: "asc" } }, machine: true, zone: true, payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] } } }),
    getPricing(),
  ]);
  if (!q) notFound();
  const isSuper = session?.role === "superadmin";
  const settlement = settlementFor(q, rulesOf(pricing));
  const finalSnap = (() => { try { return q.finalJson ? JSON.parse(q.finalJson) as { computedAt?: string } : null; } catch { return null; } })();
  const paid = paidTotal(q.payments), bill = billOf(q), balance = balanceOf(q, q.payments);
  const depositIn = q.payments.some((p) => p.kind === "deposit");
  const suggestKind = !depositIn && q.finalAmount == null ? "deposit" : balance != null && balance < 0 ? "refund" : "balance";
  const suggestAmount = suggestKind === "deposit" ? (q.depositAmount ? q.depositAmount - paid : null) : balance != null ? Math.abs(balance) : null;
  const atReturn = q.status === "on_hire" || q.status === "closed" || !!q.returnDate;
  const activity = isSuper ? await prisma.activityLog.findMany({ where: { targetType: "quote", targetId: id }, orderBy: { createdAt: "desc" }, take: 30 }) : [];
  const hours = q.hourLogs.reduce((a, l) => a + l.hours, 0), standby = q.hourLogs.reduce((a, l) => a + l.standby, 0), fuel = q.hourLogs.reduce((a, l) => a + l.fuelL, 0);
  const meterRun = q.dispatchMeter != null && q.returnMeter != null ? q.returnMeter - q.dispatchMeter : null;
  const msg = `Hello ${q.name}, RINAMAS dispatch here regarding your request ${q.reference} for ${q.machineName}.`;
  const snap = parseSnapshot(q.estimateJson);
  const stale = !!snap && (pricing.reviewedAt ?? "") > (snap.reviewedAt ?? "");
  const calcParams = new URLSearchParams({ request: q.id, ...(q.machineId ? { machine: q.machineId } : {}), ...(q.days ? { days: String(q.days) } : {}), ...(q.zoneId ? { zone: q.zoneId } : {}), operator: q.operator, fuel: q.fuel });
  const calcHref = `/admin/calculator?${calcParams}`;

  return (
    <>
      <a href="/admin" className="back">← All requests</a>
      <div className="admin-top">
        <div>
          <p className="eyebrow">Hire record</p>
          <h2 className="ref-h">{q.reference}</h2>
          <p className="muted">Received {fmtDate(q.createdAt)} · {q.machineName}</p>
        </div>
        <div className="row-form">
          <StatusPill status={q.status} />
          <a href={calcHref} className="btn btn-ghost btn-sm">Open in calculator</a>
          <a href={`tel:${intl(q.phone)}`} className="btn btn-ghost btn-sm">Call {q.name.split(" ")[0]}</a>
          <a href={waLink(intl(q.phone), msg)} target="_blank" rel="noopener" className="btn btn-wa btn-sm">WhatsApp</a>
        </div>
      </div>

      {error && ERRORS[error] && <p className="banner warn" role="alert">{ERRORS[error]} <a href="#money">Go to money</a></p>}

      <Timeline status={q.status} />

      <div className="grid-2">
        <section className="panel">
          <h3>Enquiry</h3>
          <dl className="kv">
            <dt>Customer</dt><dd>{q.name} · <a href={`tel:${intl(q.phone)}`}>{q.phone}</a></dd>
            <dt>Machine</dt><dd>{q.machineName}{q.machine && <span className="muted"> · {ghs(q.machine.dayRate)}/{q.machine.rateUnit} list</span>}</dd>
            <dt>Dates</dt><dd>{q.startDate} · {q.duration}</dd>
            <dt>Site</dt><dd>{q.site}</dd>
            <dt>Zone</dt><dd>{q.zone ? `Zone ${q.zone.name} · ${q.zone.label} · ${q.zone.towns}` : <span className="muted">Not chosen: further away or not sure. Check the site against the zones.</span>}</dd>
            <dt>Terms</dt><dd>{q.operator === "with" ? "Wet hire, operator supplied" : "Dry hire, customer's operator"} · {q.fuel === "with" ? "Fuel by RINAMAS, billed on hours" : "Customer buys fuel, full-to-full"}</dd>
            {q.notes && <><dt>Customer notes</dt><dd>“{q.notes}”</dd></>}
          </dl>
          <QuoteStatusForm id={q.id} status={q.status} adminNote={q.adminNote} className="row-form" style={{ marginTop: "1rem" }} />
        </section>

        <form action={saveHire} className="panel" style={{ display: "grid", gap: ".9rem", alignContent: "start" }}>
          <input type="hidden" name="id" value={q.id} />
          <h3>Quote &amp; deposit</h3>
          <div className="inline-form">
            <label className="f">Quoted total (GH₵)<input name="quotedAmount" type="number" min={0} defaultValue={q.quotedAmount ?? ""} /></label>
            <label className="f">Deposit required (GH₵)<input name="depositAmount" type="number" min={0} defaultValue={q.depositAmount ?? ""} /></label>
          </div>
          <p className="hint" style={{ margin: 0 }}>Record the deposit when it arrives under <a href="#money">Money</a>.</p>
          <h3>Site agent</h3>
          <div className="inline-form">
            <label className="f">Name<input name="siteAgentName" defaultValue={q.siteAgentName ?? ""} placeholder="Who signs the daily log" /></label>
            <label className="f">Phone<input name="siteAgentPhone" defaultValue={q.siteAgentPhone ?? ""} /></label>
          </div>
          <h3>Dispatch</h3>
          <div className="inline-form">
            <label className="f">Date left yard<input name="dispatchDate" type="date" defaultValue={q.dispatchDate ?? ""} /></label>
            <label className="f">Hour meter at dispatch<input name="dispatchMeter" type="number" min={0} defaultValue={q.dispatchMeter ?? ""} /></label>
          </div>
          <label className="f">Condition at dispatch<textarea name="dispatchNotes" rows={2} defaultValue={q.dispatchNotes ?? ""} placeholder="Tracks, bucket teeth, glass, leaks, fuel level. Photos on WhatsApp." /></label>
          <h3>Return</h3>
          <div className="inline-form">
            <label className="f">Date back in yard<input name="returnDate" type="date" defaultValue={q.returnDate ?? ""} /></label>
            <label className="f">Hour meter at return<input name="returnMeter" type="number" min={0} defaultValue={q.returnMeter ?? ""} /></label>
          </div>
          <label className="f">Condition at return<textarea name="returnNotes" rows={2} defaultValue={q.returnNotes ?? ""} placeholder="New damage, when first reported, repair needed" /></label>
          <div><button className="btn btn-accent btn-sm" type="submit">Save hire details</button></div>
        </form>
      </div>

      <section className="panel" style={{ marginTop: "1.2rem" }}>
        <div className="admin-top" style={{ marginBottom: ".6rem" }}>
          <div className="row-form" style={{ alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{snap?.source === "calculator" ? "Estimate applied from the calculator" : "Customer's estimate"}</h3>
            {snap && (stale
              ? <span className="pill pill-lost" title={`Estimate used rates reviewed ${snap.reviewedAt ?? "before a review date was set"}; the card was reviewed ${pricing.reviewedAt}`}><i aria-hidden="true" />Rates changed since this estimate</span>
              : <span className="pill pill-confirmed"><i aria-hidden="true" />Current rates</span>)}
          </div>
          <a href={calcHref} className="btn btn-ghost btn-sm">{snap ? "Rework in calculator" : "Price it in the calculator"}</a>
        </div>
        {!snap ? (
          <p className="muted">No estimate on this request{q.machine?.priceOnRequest ? ": this machine is priced per job after a site call" : pricing.showPrices ? "" : ": rates were hidden on the site when it came in"}. Use the calculator to price it and apply the figure here.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: ".9rem" }}>
              {snap.machineName ?? q.machineName} · {snap.days} day{snap.days === 1 ? "" : "s"} · {snap.zone ? `Zone ${snap.zone.name}, ${snap.zone.label}` : snap.km ? `${snap.km} km from the yard` : "transport not priced"} · {snap.operator ? "with operator" : "machine only"} · {snap.fuel ? "with fuel" : "customer's fuel"}
              {snap.computedAt ? ` · ${snap.source === "calculator" ? `applied by ${snap.by ?? "staff"}` : "sent from the site"} ${fmtDate(new Date(snap.computedAt))}` : ""}
              {snap.reviewedAt ? ` · rates reviewed ${snap.reviewedAt}${snap.usdRate ? ` at GH₵ ${snap.usdRate}/US$` : ""}` : ""}
            </p>
            <div className="tablewrap" style={{ marginTop: ".6rem" }}>
              <table className="compact">
                <thead><tr><th>Line</th><th>How</th><th className="num">GH₵</th></tr></thead>
                <tbody>
                  {snap.lines.map((l) => <tr key={l.key}><td>{l.label}</td><td className="muted">{l.detail}</td><td className="num">{l.amount.toLocaleString("en-GH")}</td></tr>)}
                  {snap.vat > 0 && <tr><td>VAT</td><td></td><td className="num">{snap.vat.toLocaleString("en-GH")}</td></tr>}
                  <tr><td><b>Indicative total</b></td><td className="muted">deposit {ghs(snap.deposit)}{q.quotedAmount != null && q.quotedAmount !== snap.total ? ` · quoted ${ghs(q.quotedAmount)}` : ""}</td><td className="num"><b>{snap.total.toLocaleString("en-GH")}</b></td></tr>
                </tbody>
              </table>
            </div>
            <ul className="est-notes" style={{ marginTop: ".6rem" }}>{snap.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </>
        )}
      </section>

      <section className="panel" style={{ marginTop: "1.2rem" }}>
        <div className="admin-top" style={{ marginBottom: ".8rem" }}>
          <h3>Daily hour log</h3>
          <div className="totals">
            <span><b>{hours}</b> h worked</span><span><b>{standby}</b> h standby</span><span><b>{fuel}</b> L fuel</span>
            {meterRun != null && <span><b>{meterRun}</b> h on meter</span>}
          </div>
        </div>
        <div className="tablewrap">
          <table className="compact">
            <thead><tr><th>Date</th><th>Worked</th><th>Standby</th><th>Fuel (L)</th><th>Note</th><th>Logged by</th><th></th></tr></thead>
            <tbody>
              {q.hourLogs.length === 0 && <tr><td colSpan={7} className="muted">No entries yet. Add one line per working day, signed off by the site agent.</td></tr>}
              {q.hourLogs.map((l) => (
                <tr key={l.id}>
                  <td className="num">{l.date}</td><td className="num">{l.hours}</td><td className="num">{l.standby}</td><td className="num">{l.fuelL}</td>
                  <td>{l.note}</td><td className="muted">{l.loggedBy}</td>
                  <td><form action={deleteHourLog}><input type="hidden" name="id" value={l.id} /><button className="link danger" type="submit">Remove</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={addHourLog} className="inline-form" style={{ marginTop: ".9rem" }}>
          <input type="hidden" name="quoteId" value={q.id} />
          <label className="f">Date<input name="date" type="date" required /></label>
          <label className="f">Hours worked<input name="hours" type="number" step="0.5" min={0} max={24} defaultValue={8} /></label>
          <label className="f">Standby hours<input name="standby" type="number" step="0.5" min={0} max={24} defaultValue={0} /></label>
          <label className="f">Fuel supplied (L)<input name="fuelL" type="number" step="1" min={0} defaultValue={0} /></label>
          <label className="f" style={{ gridColumn: "span 2" }}>Note<input name="note" placeholder="Standby reason, fault, who signed" /></label>
          <button className="btn btn-accent btn-sm" type="submit">Add day</button>
        </form>
      </section>

      <section className="panel money" id="money" style={{ marginTop: "1.2rem" }}>
        <div className="admin-top" style={{ marginBottom: ".8rem" }}><h3 style={{ margin: 0 }}>Money</h3></div>
        <div className="money-sum">
          <div><span>Quoted</span><b>{q.quotedAmount != null ? ghs(q.quotedAmount) : "—"}</b></div>
          <div><span>Final bill</span><b>{q.finalAmount != null ? ghs(q.finalAmount) : "Not set"}</b>{q.finalSetBy && <small>{q.finalSetBy}{q.finalSetAt ? `, ${fmtDate(q.finalSetAt)}` : ""}</small>}</div>
          <div><span>Received</span><b>{ghs(paid)}</b>{q.depositAmount ? <small>deposit required {ghs(q.depositAmount)}</small> : null}</div>
          <div className={balance == null ? "" : balance > 0 ? "owed" : balance < 0 ? "refund" : "settled"}>
            <span>{balance != null && balance < 0 ? "To refund" : "Balance due"}</span>
            <b>{balance == null ? "—" : ghs(Math.abs(balance))}</b>
            <small>{bill == null ? "nothing billed yet" : q.finalAmount != null ? "against the final bill" : "against the quote"}</small>
          </div>
        </div>

        <div className="tablewrap" style={{ marginTop: "1rem" }}>
          <table className="compact">
            <thead><tr><th>Paid on</th><th>Payment</th><th>Method</th><th>Reference</th><th className="num">GH₵</th><th>Logged by</th>{isSuper && <th></th>}</tr></thead>
            <tbody>
              {q.payments.length === 0 && <tr><td colSpan={isSuper ? 7 : 6} className="muted">No money recorded yet. Record the deposit as soon as it lands.</td></tr>}
              {q.payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.paidAt}</td>
                  <td>{PAYMENT_KINDS[p.kind as keyof typeof PAYMENT_KINDS] ?? p.kind}{p.note && <span className="muted"> · {p.note}</span>}</td>
                  <td>{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}</td>
                  <td className="muted">{p.reference}</td>
                  <td className="num">{p.kind === "refund" ? "−" : ""}{p.amount.toLocaleString("en-GH")}</td>
                  <td className="muted">{p.loggedBy}</td>
                  {isSuper && <td><form action={deletePayment}><input type="hidden" name="id" value={p.id} /><button className="link danger" type="submit">Remove</button></form></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaymentForm quoteId={q.id} suggestKind={suggestKind} suggestAmount={suggestAmount} />

        <h3 style={{ marginTop: "1.6rem" }}>Final bill</h3>
        {!atReturn && q.finalAmount == null ? (
          <p className="muted">Set the final bill when the machine is back. The settlement below fills in from the dispatch and return dates and the hour log as they are entered.</p>
        ) : null}
        {settlement == null ? (
          <p className="muted">No listed machine on this request, so there is no settlement to work out. Type the final bill.</p>
        ) : !settlement.ok ? (
          <p className="muted">Settlement: {settlement.reason}.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: ".9rem" }}>
              Settlement from the record: {settlement.days.onHire} day{settlement.days.onHire === 1 ? "" : "s"} on hire {settlement.days.source === "dates" ? "(dispatch to return)" : settlement.days.source === "logs" ? "(from the hour log)" : "(from the request)"}
              {settlement.days.standby ? `, ${settlement.days.standby} standby` : ""}{finalSnap?.computedAt && q.finalAmount === settlement.total ? " · applied as the final bill" : ""}
            </p>
            <div className="tablewrap" style={{ marginTop: ".6rem" }}>
              <table className="compact">
                <thead><tr><th>Line</th><th>How</th><th className="num">GH₵</th></tr></thead>
                <tbody>
                  {settlement.lines.map((l) => <tr key={l.key}><td>{l.label}</td><td className="muted">{l.detail}</td><td className="num">{l.amount.toLocaleString("en-GH")}</td></tr>)}
                  {settlement.vat > 0 && <tr><td>VAT</td><td></td><td className="num">{settlement.vat.toLocaleString("en-GH")}</td></tr>}
                  <tr><td><b>Settlement total</b></td><td className="muted">{q.quotedAmount != null ? `quoted ${ghs(q.quotedAmount)}${settlement.total !== q.quotedAmount ? `, ${settlement.total > q.quotedAmount ? "+" : "−"}${ghs(Math.abs(settlement.total - q.quotedAmount))}` : ""}` : ""}</td><td className="num"><b>{settlement.total.toLocaleString("en-GH")}</b></td></tr>
                </tbody>
              </table>
            </div>
            {settlement.notes.length > 0 && <ul className="est-notes" style={{ marginTop: ".6rem" }}>{settlement.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          </>
        )}
        <FinalBillForm id={q.id} canSettle={!!settlement?.ok} settleTotal={settlement?.ok ? settlement.total : null} current={q.finalAmount} />
      </section>

      {isSuper && (
        <section className="panel" style={{ marginTop: "1.2rem" }}>
          <h3>Activity on this record</h3>
          <ul className="activity">
            {activity.length === 0 && <li className="muted">Nothing logged yet.</li>}
            {activity.map((a) => <li key={a.id}><time>{fmtDate(a.createdAt)}</time><b>{a.actorName}</b><span>{a.summary}</span></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
