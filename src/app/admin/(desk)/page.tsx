import { prisma } from "@/lib/db";
import { ALL_STATUSES, STATUS_LABEL, fmtDate, ghs, intl, waLink } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { NoteByline, QuoteStatusForm, StatusPill } from "@/components/StatusBits";
import { setOwner } from "@/app/admin/actions";
import { after } from "next/server";
import { WAIT_HOURS, alertWaiting, waitingWhere } from "@/lib/notify";
import { balanceOf } from "@/lib/settle";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; denied?: string; who?: string }> }) {
  const { status, q, denied, who: whoParam } = await searchParams;
  const session = await getSession();
  // who: "mine", "none" (not taken), or a staff id (from the Team page)
  const person = whoParam && whoParam !== "mine" && whoParam !== "none" ? await prisma.staff.findUnique({ where: { id: whoParam }, select: { id: true, name: true } }) : null;
  const who = whoParam === "mine" || whoParam === "none" ? whoParam : person && person.id !== session?.id ? person.id : person ? "mine" : null;
  const whoWhere = who === "mine" ? { ownerId: session?.id ?? "-" } : who === "none" ? { ownerId: null } : who ? { ownerId: who } : {};
  const where = {
    ...whoWhere,
    ...(status && (ALL_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    ...(q ? { OR: [{ reference: { contains: q } }, { name: { contains: q } }, { phone: { contains: q } }, { site: { contains: q } }, { machineName: { contains: q } }] } : {}),
  };
  const [quotes, counts] = await Promise.all([
    prisma.quoteRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: {
      payments: { select: { kind: true, amount: true } },
      owner: { select: { id: true, name: true } },
      deskNotes: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { deskNotes: true } },
    } }),
    prisma.quoteRequest.groupBy({ by: ["status"], where: whoWhere, _count: { _all: true } }),
  ]);
  const OPEN = ["new", "quoted", "confirmed", "on_hire"];
  const [mineOpen, freeOpen, waiting] = await Promise.all([
    session ? prisma.quoteRequest.count({ where: { ownerId: session.id, status: { in: OPEN } } }) : 0,
    prisma.quoteRequest.count({ where: { ownerId: null, status: { in: OPEN } } }),
    prisma.quoteRequest.count({ where: waitingWhere() }),
  ]);
  // a desk load is also a chance to send the waiting-request email (the scheduled check is the main one)
  if (waiting) after(() => alertWaiting().catch((e) => console.error("alertWaiting", e)));
  const href = (p: { status?: string; q?: string; who?: string | null }) => {
    const u = new URLSearchParams();
    if (p.status) u.set("status", p.status); if (p.q) u.set("q", p.q); if (p.who) u.set("who", p.who);
    const s = u.toString(); return `/admin${s ? `?${s}` : ""}`;
  };
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((a, c) => a + c._count._all, 0);

  return (
    <>
      {denied && <p className="banner warn">That page is for the super admin only.</p>}
      {waiting > 0 && who !== "none" && (
        <p className="banner warn" role="alert">
          {waiting} request{waiting === 1 ? " has" : "s have"} waited over {WAIT_HOURS} hours with nobody on {waiting === 1 ? "it" : "them"}. The customer is waiting for a call. <a href="/admin?who=none">Take one now</a>
        </p>
      )}
      <div className="admin-top">
        <div><p className="eyebrow">Dispatch desk</p><h2>Quote requests</h2></div>
        <form className="search" action="/admin" method="get">
          {status && <input type="hidden" name="status" value={status} />}
          {who && <input type="hidden" name="who" value={who} />}
          <input name="q" defaultValue={q ?? ""} placeholder="Search ref, name, phone, site…" aria-label="Search requests" />
          <button className="btn btn-ghost btn-sm" type="submit">Search</button>
        </form>
      </div>

      <div className="tiles">
        <a className={`tile tile-new ${status === "new" ? "is-active" : ""}`} href={href({ status: "new", who })}><b>{count("new")}</b><span>New, awaiting quote</span></a>
        <a className={`tile tile-quoted ${status === "quoted" ? "is-active" : ""}`} href={href({ status: "quoted", who })}><b>{count("quoted")}</b><span>Quoted, awaiting deposit</span></a>
        <a className={`tile tile-confirmed ${status === "confirmed" ? "is-active" : ""}`} href={href({ status: "confirmed", who })}><b>{count("confirmed")}</b><span>Confirmed, to dispatch</span></a>
        <a className={`tile tile-on_hire ${status === "on_hire" ? "is-active" : ""}`} href={href({ status: "on_hire", who })}><b>{count("on_hire")}</b><span>On hire now</span></a>
      </div>

      <div className="desk-filters">
        <div className="segmented" role="tablist" aria-label="Filter by who is handling it">
          <a role="tab" aria-selected={!who} href={href({ status, q })}>Everyone</a>
          <a role="tab" aria-selected={who === "mine"} href={href({ status, q, who: "mine" })} title="Open requests you are handling">Mine <em>{mineOpen}</em></a>
          <a role="tab" aria-selected={who === "none"} href={href({ status, q, who: "none" })} title="Open requests nobody has taken yet">Not taken <em>{freeOpen}</em></a>
          {person && who === person.id && <a role="tab" aria-selected href={href({ status, q, who: person.id })}>{person.name}</a>}
        </div>
        <div className="segmented" role="tablist" aria-label="Filter by status">
          <a role="tab" aria-selected={!status} href={href({ q, who })}>All <em>{total}</em></a>
          {ALL_STATUSES.map((s) => (
            <a key={s} role="tab" aria-selected={status === s} href={href({ status: s, q, who })}>{STATUS_LABEL[s]} <em>{count(s)}</em></a>
          ))}
        </div>
      </div>

      {quotes.length === 0 && (
        <div className="empty">
          <b>No requests {who === "mine" ? "handled by you " : who === "none" ? "waiting to be taken " : person && who === person.id ? `handled by ${person.name} ` : ""}{status ? `marked ${STATUS_LABEL[status]}` : "yet"}{q ? ` matching “${q}”` : ""}.</b>
          <span>When a customer sends the quote form on the site, or a request through the Ask RINAMAS chat, it appears here with a reference number. You can also open a request directly if the customer calls with their reference.</span>
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
                {qr.owner ? (
                  <span className={`owner-tag${qr.owner.id === session?.id ? " is-me" : ""}`}>{qr.owner.id === session?.id ? (qr.handedByName ? `Handed to you by ${qr.handedByName}` : "You're handling") : `Handled by ${qr.owner.name}`}</span>
                ) : (
                  <form action={setOwner} className="owner-take">
                    <input type="hidden" name="id" value={qr.id} /><input type="hidden" name="ownerId" value="me" />
                    <span className="owner-tag is-free">Not taken</span>
                    <button className="btn btn-ghost btn-xs" type="submit">Take it</button>
                  </form>
                )}
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
                  {qr.source === "chat" && <span className="chip-s chip-chat">Via chat</span>}
                </div>
                {qr.notes && <span className="muted note">“{qr.notes}”</span>}
                {qr.deskNotes[0] && (
                  <p className="desk-note"><NoteByline authorName={qr.deskNotes[0].authorName} createdAt={qr.deskNotes[0].createdAt} />{qr.deskNotes[0].body}
                    {qr._count.deskNotes > 1 && <a href={`/admin/requests/${qr.id}#notes`} className="more">+{qr._count.deskNotes - 1} earlier</a>}</p>
                )}
              </div>
              <QuoteStatusForm id={qr.id} status={qr.status} className="req-act" notePlaceholder="e.g. quoted GH₵ 9,200, awaiting MoMo" />
            </article>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: "1.4rem" }}>Every change is recorded with the name of the person who made it. Open a request to see its history. Whoever first works on a request becomes its handler; hand it over from the request page.</p>
    </>
  );
}
