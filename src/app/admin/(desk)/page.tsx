import { prisma } from "@/lib/db";
import { ALL_STATUSES, STATUS_LABEL, fmtDate, ghs, intl, waLink } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { QuoteStatusForm, StatusPill } from "@/components/StatusBits";
import { balanceOf } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; denied?: string }> }) {
  const { status, q, denied } = await searchParams;
  const session = await getSession();
  const where = {
    ...(status && (ALL_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(q ? { OR: [{ reference: { contains: q } }, { name: { contains: q } }, { phone: { contains: q } }, { site: { contains: q } }, { machineName: { contains: q } }] } : {}),
  };
  const [quotes, counts] = await Promise.all([
    prisma.quoteRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { payments: { select: { kind: true, amount: true } } } }),
    prisma.quoteRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((a, c) => a + c._count._all, 0);

  return (
    <>
      {denied && <p className="banner warn">That page is for the super admin only.</p>}
      <div className="admin-top">
        <div><p className="eyebrow">Dispatch desk</p><h2>Quote requests</h2></div>
        <form className="search" action="/admin" method="get">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q ?? ""} placeholder="Search ref, name, phone, site…" aria-label="Search requests" />
          <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        </form>
      </div>

      <div className="tiles">
        <a className={`tile tile-new ${status === "new" ? "is-active" : ""}`} href="/admin?status=new"><b>{count("new")}</b><span>New, awaiting quote</span></a>
        <a className={`tile tile-quoted ${status === "quoted" ? "is-active" : ""}`} href="/admin?status=quoted"><b>{count("quoted")}</b><span>Quoted, awaiting deposit</span></a>
        <a className={`tile tile-confirmed ${status === "confirmed" ? "is-active" : ""}`} href="/admin?status=confirmed"><b>{count("confirmed")}</b><span>Confirmed, to dispatch</span></a>
        <a className={`tile tile-on_hire ${status === "on_hire" ? "is-active" : ""}`} href="/admin?status=on_hire"><b>{count("on_hire")}</b><span>On hire now</span></a>
      </div>

      <div className="segmented" role="tablist" aria-label="Filter by status">
        <a role="tab" aria-selected={!status} href={q ? `/admin?q=${encodeURIComponent(q)}` : "/admin"}>All <em>{total}</em></a>
        {ALL_STATUSES.map((s) => (
          <a key={s} role="tab" aria-selected={status === s} href={`/admin?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>{STATUS_LABEL[s]} <em>{count(s)}</em></a>
        ))}
      </div>

      {quotes.length === 0 && (
        <div className="empty">
          <b>No requests {status ? `marked ${STATUS_LABEL[status]}` : "yet"}{q ? ` matching “${q}”` : ""}.</b>
          <span>When a customer sends the quote form on the site, it appears here with a reference number. You can also open a request directly if the customer calls with their reference.</span>
        </div>
      )}

      <div className="reqs">
        {quotes.map((qr) => {
          const bal = balanceOf(qr, qr.payments);
          const money = qr.status === "closed" && qr.finalAmount == null ? { cls: "chip-owed", text: "No final bill" }
            : qr.finalAmount != null ? (bal && bal > 0 ? { cls: "chip-owed", text: `Owes ${ghs(bal)}` } : bal && bal < 0 ? { cls: "chip-money", text: `Refund ${ghs(-bal)}` } : { cls: "chip-money", text: `Paid ${ghs(qr.finalAmount)}` })
            : qr.quotedAmount ? { cls: "chip-money", text: `${ghs(qr.quotedAmount)}${qr.payments.length ? `, ${ghs(qr.quotedAmount - (bal ?? 0))} in` : ""}` } : null;
          const msg = `Hello ${qr.name}, RINAMAS dispatch here regarding your request ${qr.reference} for ${qr.machineName} from ${qr.startDate}.`;
          return (
            <article className={`req req-${qr.status}`} key={qr.id}>
              <a className="req-link" href={`/admin/requests/${qr.id}`} aria-label={`Open ${qr.reference}`}></a>
              <div className="req-id">
                <a href={`/admin/requests/${qr.id}`} className="ref">{qr.reference}</a>
                <small>{fmtDate(qr.createdAt)}</small>
                <StatusPill status={qr.status} />
              </div>
              <div className="req-cust">
                <b>{qr.name}</b>
                <a href={`tel:${intl(qr.phone)}`} className="tel">{qr.phone}</a>
                <a href={waLink(intl(qr.phone), msg)} target="_blank" rel="noopener" className="btn btn-wa btn-xs">WhatsApp</a>
              </div>
              <div className="req-job">
                <b>{qr.machineName}</b>
                <span>{qr.startDate} · {qr.duration}</span>
                <span className="muted">{qr.site}</span>
                <div className="chips">
                  <span className="chip-s">{qr.operator === "with" ? "Wet hire · operator" : "Dry hire · machine only"}</span>
                  <span className="chip-s">{qr.fuel === "with" ? "Fuel by RINAMAS" : "Customer's fuel"}</span>
                  {money && <span className={`chip-s ${money.cls}`}>{money.text}</span>}
                </div>
                {qr.notes && <span className="muted note">“{qr.notes}”</span>}
              </div>
              <QuoteStatusForm id={qr.id} status={qr.status} adminNote={qr.adminNote} className="req-act" notePlaceholder="e.g. quoted GH₵ 9,200, awaiting MoMo" />
            </article>
          );
        })}
      </div>
      {session?.role === "superadmin" && <p className="hint" style={{ marginTop: "1.4rem" }}>Every change made here is recorded under Activity.</p>}
    </>
  );
}
