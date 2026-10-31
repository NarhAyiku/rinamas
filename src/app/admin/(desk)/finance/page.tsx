import { prisma } from "@/lib/db";
import { requireSuper } from "@/lib/auth";
import { STATUS_LABEL, fmtDate, ghs, intl } from "@/lib/format";
import { PAYMENT_KINDS, PAYMENT_METHODS, balanceOf, paidTotal } from "@/lib/settle";
import { StatusPill } from "@/components/StatusBits";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const ymOf = (d: Date) => d.toISOString().slice(0, 7);
const signed = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireSuper();
  const { month: m } = await searchParams;
  const thisMonth = ymOf(new Date());
  const month = m === "all" ? "all" : m && /^\d{4}-\d{2}$/.test(m) ? m : thisMonth;
  const inMonth = (ym: string | null | undefined) => month === "all" || ym === month;

  // Small business volumes: every job with money on it, worked in memory.
  const jobs = await prisma.quoteRequest.findMany({
    where: { OR: [{ status: { in: ["confirmed", "on_hire", "closed"] } }, { payments: { some: {} } }, { finalAmount: { not: null } }] },
    include: { payments: true },
    orderBy: { createdAt: "desc" },
  });
  const payments = jobs.flatMap((q) => q.payments.map((p) => ({ ...p, q })));

  const periodPays = payments.filter((p) => inMonth(p.paidAt.slice(0, 7))).sort((a, b) => b.paidAt.localeCompare(a.paidAt) || +b.createdAt - +a.createdAt);
  const collected = periodPays.reduce((a, p) => a + signed(p), 0);
  const byMethod = Object.keys(PAYMENT_METHODS).map((k) => ({ k, total: periodPays.filter((p) => p.method === k).reduce((a, p) => a + signed(p), 0) })).filter((x) => x.total !== 0);
  const billedJobs = jobs.filter((q) => q.finalAmount != null && q.finalSetAt && inMonth(ymOf(q.finalSetAt)));
  const billed = billedJobs.reduce((a, q) => a + (q.finalAmount ?? 0), 0);

  const live = jobs.filter((q) => q.status !== "lost");
  const owed = live.map((q) => ({ q, bal: balanceOf(q, q.payments) ?? 0, paid: paidTotal(q.payments) }))
    .filter((x) => x.bal > 0 && (x.q.finalAmount != null || x.q.status === "on_hire" || x.q.status === "closed"))
    .sort((a, b) => b.bal - a.bal);
  const owedTotal = owed.reduce((a, x) => a + x.bal, 0);
  const refunds = live.map((q) => ({ q, bal: balanceOf(q, q.payments) ?? 0 })).filter((x) => x.bal < 0);
  const held = live.filter((q) => q.finalAmount == null && (q.status === "confirmed" || q.status === "on_hire")).reduce((a, q) => a + paidTotal(q.payments), 0);
  const closedNoBill = jobs.filter((q) => q.status === "closed" && q.finalAmount == null);

  // Last 12 months, oldest first.
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push(ymOf(d)); }
  const monthly = months.map((ym) => ({
    ym,
    billed: jobs.filter((q) => q.finalAmount != null && q.finalSetAt && ymOf(q.finalSetAt) === ym).reduce((a, q) => a + (q.finalAmount ?? 0), 0),
    collected: payments.filter((p) => p.paidAt.slice(0, 7) === ym).reduce((a, p) => a + signed(p), 0),
    jobs: jobs.filter((q) => q.finalAmount != null && q.finalSetAt && ymOf(q.finalSetAt) === ym).length,
  }));
  const byMachine = Object.entries(billedJobs.reduce<Record<string, { billed: number; jobs: number }>>((acc, q) => {
    const k = q.machineName; acc[k] ??= { billed: 0, jobs: 0 }; acc[k].billed += q.finalAmount ?? 0; acc[k].jobs += 1; return acc;
  }, {})).sort((a, b) => b[1].billed - a[1].billed);

  const period = month === "all" ? "all time" : monthLabel(month);
  const prev = month === "all" ? null : (() => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return ymOf(d); })();
  const next = month === "all" || month >= thisMonth ? null : (() => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return ymOf(d); })();

  return (
    <>
      <div className="admin-top">
        <div><p className="eyebrow">Management</p><h2>Finance</h2></div>
        <div className="row-form">
          {prev && <a className="btn btn-ghost btn-sm" href={`/admin/finance?month=${prev}`}>← {monthLabel(prev)}</a>}
          {month !== thisMonth && <a className="btn btn-ghost btn-sm" href="/admin/finance">This month</a>}
          {next && <a className="btn btn-ghost btn-sm" href={`/admin/finance?month=${next}`}>{monthLabel(next)} →</a>}
          <a className="btn btn-ghost btn-sm" href={month === "all" ? "/admin/finance" : "/admin/finance?month=all"}>{month === "all" ? "By month" : "All time"}</a>
          <a className="btn btn-ghost btn-sm" href={`/admin/finance/export?month=${month}`}>Download payments (CSV)</a>
        </div>
      </div>
      <p className="lede" style={{ marginBottom: "1.2rem" }}>Money on every hire, for {period}. Billed counts final bills set in the period; collected counts payments received in it, less refunds. Owed and held are as of today.</p>

      {closedNoBill.length > 0 && (
        <p className="banner warn" role="alert">
          {closedNoBill.length} closed job{closedNoBill.length === 1 ? " has" : "s have"} no final bill, so {closedNoBill.length === 1 ? "its" : "their"} money is missing from these figures:{" "}
          {closedNoBill.slice(0, 8).map((q, i) => <span key={q.id}>{i ? ", " : ""}<a href={`/admin/requests/${q.id}#money`}>{q.reference}</a></span>)}{closedNoBill.length > 8 ? "…" : ""}
        </p>
      )}

      <div className="tiles money-tiles">
        <div className="tile tile-confirmed"><b>{ghs(collected)}</b><span>Collected, {period}</span></div>
        <div className="tile tile-quoted"><b>{ghs(billed)}</b><span>Billed, {billedJobs.length} job{billedJobs.length === 1 ? "" : "s"}</span></div>
        <div className="tile tile-on_hire"><b>{ghs(owedTotal)}</b><span>Owed to RINAMAS, {owed.length} job{owed.length === 1 ? "" : "s"}</span></div>
        <div className="tile tile-new"><b>{ghs(held)}</b><span>Deposits on open jobs</span></div>
      </div>
      {byMethod.length > 0 && <p className="muted" style={{ marginTop: "-.4rem" }}>Collected by method: {byMethod.map((x) => `${PAYMENT_METHODS[x.k as keyof typeof PAYMENT_METHODS]} ${ghs(x.total)}`).join(" · ")}</p>}

      <section className="panel" style={{ marginTop: "1.2rem" }}>
        <h3>Owed to RINAMAS</h3>
        <div className="tablewrap">
          <table className="compact">
            <thead><tr><th>Ref</th><th>Customer</th><th>Status</th><th>Back in yard</th><th className="num">Bill</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {owed.length === 0 && <tr><td colSpan={7} className="muted">Nobody owes anything on a billed or running job.</td></tr>}
              {owed.map(({ q, bal, paid }) => (
                <tr key={q.id}>
                  <td><a href={`/admin/requests/${q.id}#money`}>{q.reference}</a></td>
                  <td>{q.name} · <a href={`tel:${intl(q.phone)}`}>{q.phone}</a></td>
                  <td><StatusPill status={q.status} /></td>
                  <td className="num">{q.returnDate ?? <span className="muted">on site</span>}</td>
                  <td className="num">{(q.finalAmount ?? q.quotedAmount ?? 0).toLocaleString("en-GH")}{q.finalAmount == null && <span className="muted"> quoted</span>}</td>
                  <td className="num">{paid.toLocaleString("en-GH")}</td>
                  <td className="num"><b>{bal.toLocaleString("en-GH")}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {refunds.length > 0 && <p className="hint">To refund: {refunds.map(({ q, bal }) => <span key={q.id}><a href={`/admin/requests/${q.id}#money`}>{q.reference}</a> {ghs(-bal)} </span>)}</p>}
      </section>

      <div className="grid-2" style={{ marginTop: "1.2rem" }}>
        <section className="panel">
          <h3>Last 12 months</h3>
          <div className="tablewrap">
            <table className="compact">
              <thead><tr><th>Month</th><th className="num">Jobs billed</th><th className="num">Billed GH₵</th><th className="num">Collected GH₵</th></tr></thead>
              <tbody>
                {[...monthly].reverse().map((r) => (
                  <tr key={r.ym}>
                    <td><a href={`/admin/finance?month=${r.ym}`}>{monthLabel(r.ym)}</a></td>
                    <td className="num">{r.jobs || ""}</td>
                    <td className="num">{r.billed ? r.billed.toLocaleString("en-GH") : ""}</td>
                    <td className="num">{r.collected ? r.collected.toLocaleString("en-GH") : ""}</td>
                  </tr>
                ))}
                <tr><td><b>12 months</b></td><td className="num"><b>{monthly.reduce((a, r) => a + r.jobs, 0)}</b></td><td className="num"><b>{monthly.reduce((a, r) => a + r.billed, 0).toLocaleString("en-GH")}</b></td><td className="num"><b>{monthly.reduce((a, r) => a + r.collected, 0).toLocaleString("en-GH")}</b></td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h3>Billed by machine, {period}</h3>
          <div className="tablewrap">
            <table className="compact">
              <thead><tr><th>Machine</th><th className="num">Jobs</th><th className="num">GH₵</th></tr></thead>
              <tbody>
                {byMachine.length === 0 && <tr><td colSpan={3} className="muted">No final bills in this period.</td></tr>}
                {byMachine.map(([name, v]) => <tr key={name}><td>{name}</td><td className="num">{v.jobs}</td><td className="num">{v.billed.toLocaleString("en-GH")}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1.2rem" }}>
        <h3>Payments, {period}</h3>
        <div className="tablewrap">
          <table className="compact">
            <thead><tr><th>Paid on</th><th>Ref</th><th>Customer</th><th>Payment</th><th>Method</th><th>Reference</th><th className="num">GH₵</th><th>Logged by</th></tr></thead>
            <tbody>
              {periodPays.length === 0 && <tr><td colSpan={8} className="muted">No payments recorded in this period.</td></tr>}
              {periodPays.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.paidAt}</td>
                  <td><a href={`/admin/requests/${p.quoteId}#money`}>{p.q.reference}</a></td>
                  <td>{p.q.name}</td>
                  <td>{PAYMENT_KINDS[p.kind as keyof typeof PAYMENT_KINDS] ?? p.kind}</td>
                  <td>{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method}</td>
                  <td className="muted">{p.reference}</td>
                  <td className="num">{signed(p).toLocaleString("en-GH")}</td>
                  <td className="muted">{p.loggedBy} · {fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="hint" style={{ marginTop: "1rem" }}>Statuses: {Object.values(STATUS_LABEL).join(", ")}. Lost jobs are left out unless money was taken on them.</p>
    </>
  );
}
