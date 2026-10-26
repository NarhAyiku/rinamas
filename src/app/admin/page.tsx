import { prisma } from "@/lib/db";
import { STATUSES, waLink } from "@/lib/format";
import { updateQuote } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const where = status && (STATUSES as readonly string[]).includes(status) ? { status } : {};
  const [quotes, counts] = await Promise.all([
    prisma.quoteRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.quoteRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const wa = process.env.WHATSAPP_NUMBER ?? "233243518749";

  return (
    <>
      <div className="admin-top">
        <div><p className="eyebrow">Dispatch desk</p><h2>Quote requests</h2></div>
        <div className="filters" style={{ margin: 0 }}>
          <a className="chip" aria-pressed={!status} href="/admin">All</a>
          {STATUSES.map((s) => <a key={s} className="chip" aria-pressed={status === s} href={`/admin?status=${s}`}>{s} · {count(s)}</a>)}
        </div>
      </div>
      <div className="tiles">
        {STATUSES.map((s) => <div className="tile" key={s}><b>{count(s)}</b><span>{s}</span></div>)}
      </div>
      {quotes.length === 0 && <p className="lede">No requests yet. When a customer sends the quote form on the site, it lands here.</p>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>Ref · received</th><th>Customer</th><th>Job</th><th>Status &amp; note</th></tr></thead>
          <tbody>
            {quotes.map((q) => {
              const ph = q.phone.replace(/\D/g, "").replace(/^0/, "233");
              const msg = `Hello ${q.name}, RINAMAS dispatch here regarding your quote request ${q.reference} for ${q.machineName} from ${q.startDate}.`;
              return (
                <tr key={q.id}>
                  <td><span className="ref" style={{ fontSize: "1rem" }}>{q.reference}</span><br /><small style={{ color: "var(--muted)" }}>{q.createdAt.toLocaleString("en-GB", { timeZone: "Africa/Accra" })}</small></td>
                  <td><b>{q.name}</b><br />{q.phone}<br /><a href={waLink(ph.length >= 12 ? ph : wa, msg)} target="_blank" rel="noopener" style={{ fontSize: ".85rem" }}>Reply on WhatsApp ↗</a></td>
                  <td><b>{q.machineName}</b><br />{q.startDate} · {q.duration}<br />{q.site}<br />
                    <small style={{ color: "var(--muted)" }}>{q.operator === "with" ? "With operator" : "Machine only"} · {q.fuel === "with" ? "With fuel" : "Without fuel"}</small>
                    {q.notes && <><br /><small style={{ color: "var(--muted)" }}>“{q.notes}”</small></>}</td>
                  <td>
                    <form action={updateQuote} className="row-form">
                      <input type="hidden" name="id" value={q.id} />
                      <span className={`pill pill-${q.status}`}>{q.status}</span>
                      <select name="status" defaultValue={q.status}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                      <input name="adminNote" defaultValue={q.adminNote ?? ""} placeholder="Internal note, e.g. quoted GH₵ 9,200" style={{ minWidth: 200 }} />
                      <button className="btn btn-ghost btn-sm" type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
