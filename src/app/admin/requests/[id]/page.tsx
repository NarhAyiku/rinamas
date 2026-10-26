import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ALL_STATUSES, STATUS_HINT, STATUS_LABEL, STATUSES, fmtDate, ghs, intl, waLink } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { StatusPill } from "@/components/StatusBits";
import { addHourLog, deleteHourLog, saveHire, updateQuote } from "../../actions";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const q = await prisma.quoteRequest.findUnique({ where: { id }, include: { hourLogs: { orderBy: { date: "asc" } }, machine: true } });
  if (!q) notFound();
  const activity = session?.role === "superadmin" ? await prisma.activityLog.findMany({ where: { targetType: "quote", targetId: id }, orderBy: { createdAt: "desc" }, take: 30 }) : [];
  const hours = q.hourLogs.reduce((a, l) => a + l.hours, 0), standby = q.hourLogs.reduce((a, l) => a + l.standby, 0), fuel = q.hourLogs.reduce((a, l) => a + l.fuelL, 0);
  const meterRun = q.dispatchMeter != null && q.returnMeter != null ? q.returnMeter - q.dispatchMeter : null;
  const stepIdx = STATUSES.indexOf(q.status as (typeof STATUSES)[number]);
  const msg = `Hello ${q.name}, RINAMAS dispatch here regarding your request ${q.reference} for ${q.machineName}.`;

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
          <a href={`tel:${intl(q.phone)}`} className="btn btn-ghost btn-sm">Call {q.name.split(" ")[0]}</a>
          <a href={waLink(intl(q.phone), msg)} target="_blank" rel="noopener" className="btn btn-wa btn-sm">WhatsApp</a>
        </div>
      </div>

      <ol className="timeline" aria-label="Hire progress">
        {STATUSES.map((s, i) => (
          <li key={s} className={i < stepIdx ? "done" : i === stepIdx ? "now" : ""}><b>{STATUS_LABEL[s]}</b><span>{STATUS_HINT[s]}</span></li>
        ))}
        {q.status === "lost" && <li className="lost"><b>Lost</b><span>{STATUS_HINT.lost}</span></li>}
      </ol>

      <div className="grid-2">
        <section className="panel">
          <h3>Enquiry</h3>
          <dl className="kv">
            <dt>Customer</dt><dd>{q.name} · <a href={`tel:${intl(q.phone)}`}>{q.phone}</a></dd>
            <dt>Machine</dt><dd>{q.machineName}{q.machine && <span className="muted"> · {ghs(q.machine.dayRate)}/{q.machine.rateUnit} list</span>}</dd>
            <dt>Dates</dt><dd>{q.startDate} · {q.duration}</dd>
            <dt>Site</dt><dd>{q.site}</dd>
            <dt>Terms</dt><dd>{q.operator === "with" ? "Wet hire, operator supplied" : "Dry hire, customer's operator"} · {q.fuel === "with" ? "Fuel by RINAMAS, billed on hours" : "Customer buys fuel, full-to-full"}</dd>
            {q.notes && <><dt>Customer notes</dt><dd>“{q.notes}”</dd></>}
          </dl>
          <form action={updateQuote} className="row-form" style={{ marginTop: "1rem" }}>
            <input type="hidden" name="id" value={q.id} />
            <label className="f">Status<select name="status" defaultValue={q.status}>{ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
            <label className="f" style={{ flex: 1 }}>Internal note<input name="adminNote" defaultValue={q.adminNote ?? ""} /></label>
            <button className="btn btn-accent btn-sm" type="submit">Save</button>
          </form>
        </section>

        <form action={saveHire} className="panel" style={{ display: "grid", gap: ".9rem", alignContent: "start" }}>
          <input type="hidden" name="id" value={q.id} />
          <h3>Quote &amp; deposit</h3>
          <div className="inline-form">
            <label className="f">Quoted total (GH₵)<input name="quotedAmount" type="number" min={0} defaultValue={q.quotedAmount ?? ""} /></label>
            <label className="f">Deposit (GH₵)<input name="depositAmount" type="number" min={0} defaultValue={q.depositAmount ?? ""} /></label>
            <label className="f">Deposit paid on<input name="depositPaidAt" type="date" defaultValue={q.depositPaidAt ?? ""} /></label>
            <label className="f">Method<select name="depositMethod" defaultValue={q.depositMethod ?? ""}><option value="">—</option><option value="momo">MoMo</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option></select></label>
          </div>
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

      {session?.role === "superadmin" && (
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
