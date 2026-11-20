import { prisma } from "@/lib/db";
import { requireSuper } from "@/lib/auth";
import { ghs } from "@/lib/format";
import { balanceOf, billOf } from "@/lib/settle";

export const dynamic = "force-dynamic";

const OPEN = ["new", "quoted", "confirmed", "on_hire"];
const WON = ["confirmed", "on_hire", "closed"];
const RANGES = [["month", "This month"], ["last", "Last month"], ["d90", "Last 90 days"], ["all", "All time"]] as const;
type Range = (typeof RANGES)[number][0];

/** [from, to) in Accra time (UTC+0), or null bounds for all time. */
function bounds(r: Range): [Date | null, Date | null] {
  const now = new Date();
  const m0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (r === "month") return [m0, null];
  if (r === "last") return [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), m0];
  if (r === "d90") return [new Date(now.getTime() - 90 * 86_400_000), null];
  return [null, null];
}
const signed = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireSuper();
  const { range: r } = await searchParams;
  const range: Range = RANGES.find(([k]) => k === r)?.[0] ?? "month";
  const [from, to] = bounds(range);
  const inRange = (d: Date) => (!from || d >= from) && (!to || d < to);
  const dayFrom = from?.toISOString().slice(0, 10), dayTo = to?.toISOString().slice(0, 10);
  const dayInRange = (ymd: string) => (!dayFrom || ymd >= dayFrom) && (!dayTo || ymd < dayTo);

  // Small business volumes: every request, worked in memory.
  const [staff, quotes, actions] = await Promise.all([
    prisma.staff.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, role: true, active: true } }),
    prisma.quoteRequest.findMany({ include: { payments: true }, orderBy: { createdAt: "desc" } }),
    prisma.activityLog.groupBy({ by: ["staffId"], where: { staffId: { not: null }, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}) }, _count: { _all: true } }),
  ]);

  const rowFor = (ownerId: string | null) => {
    const mine = quotes.filter((q) => q.ownerId === ownerId);
    const taken = mine.filter((q) => inRange(q.createdAt));
    const won = taken.filter((q) => WON.includes(q.status));
    const lost = taken.filter((q) => q.status === "lost");
    const owed = mine.filter((q) => q.status !== "lost" && (q.finalAmount != null || q.status === "on_hire" || q.status === "closed"))
      .reduce((a, q) => a + Math.max(0, balanceOf(q, q.payments) ?? 0), 0);
    return {
      open: mine.filter((q) => OPEN.includes(q.status)).length,
      taken: taken.length,
      won: won.length,
      lost: lost.length,
      pending: taken.length - won.length - lost.length,
      valueWon: won.reduce((a, q) => a + (billOf(q) ?? 0), 0),
      moneyIn: mine.flatMap((q) => q.payments).filter((p) => dayInRange(p.paidAt)).reduce((a, p) => a + signed(p), 0),
      owed,
    };
  };
  const people = staff.map((p) => ({ ...p, ...rowFor(p.id), actions: actions.find((a) => a.staffId === p.id)?._count._all ?? 0 }))
    .filter((p) => p.active || p.taken || p.open || p.moneyIn || p.owed);
  const free = rowFor(null);
  const sum = (k: "open" | "taken" | "won" | "lost" | "pending" | "valueWon" | "moneyIn" | "owed") => people.reduce((a, p) => a + p[k], 0) + free[k];
  const best = [...people].sort((a, b) => b.valueWon - a.valueWon)[0];

  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Management</p><h2>Team</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.2rem" }}>How each person on the desk is doing, by the requests they handle. A request belongs to whoever is handling it now; requests from before handlers existed were credited to the first person who worked on them.</p>
      <div className="segmented" role="tablist" aria-label="Period">
        {RANGES.map(([k, label]) => <a key={k} role="tab" aria-selected={range === k} href={k === "month" ? "/admin/team" : `/admin/team?range=${k}`}>{label}</a>)}
      </div>

      {free.open > 0 && (
        <p className="banner warn" role="alert">{free.open} open request{free.open === 1 ? " is" : "s are"} not taken by anyone. <a href="/admin?who=none">See them</a></p>
      )}

      <div className="tablewrap">
        <table className="compact team">
          <thead>
            <tr>
              <th>Person</th>
              <th className="num" title="Open requests they are handling today">Open now</th>
              <th className="num" title="Requests received in the period that they handle">Taken</th>
              <th className="num" title="Confirmed, on hire or closed">Won</th>
              <th className="num">Lost</th>
              <th className="num" title="Won out of won plus lost">Win rate</th>
              <th className="num" title="Final bill, or the quote where no final bill is set yet, on the jobs they won">Value won</th>
              <th className="num" title="Payments received in the period on their jobs, less refunds">Money in</th>
              <th className="num" title="Balance customers owe today on their jobs">Owed now</th>
              <th className="num" title="Changes they made on the desk in the period">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td><a href={`/admin?who=${p.id}`}><b>{p.name}</b></a>{!p.active ? <small className="muted">deactivated</small> : p.role === "superadmin" ? <small className="muted">super admin</small> : null}</td>
                <td className="num">{p.open}</td>
                <td className="num">{p.taken}{p.pending > 0 && <small className="muted"> ({p.pending} pending)</small>}</td>
                <td className="num">{p.won}</td>
                <td className="num">{p.lost}</td>
                <td className="num">{pct(p.won, p.won + p.lost)}</td>
                <td className="num">{ghs(p.valueWon)}</td>
                <td className="num">{ghs(p.moneyIn)}</td>
                <td className={`num${p.owed > 0 ? " owed" : ""}`}>{ghs(p.owed)}</td>
                <td className="num"><a href={`/admin/activity?staff=${p.id}`}>{p.actions}</a></td>
              </tr>
            ))}
            <tr className="muted-row">
              <td><a href="/admin?who=none">Not taken</a></td>
              <td className="num">{free.open}</td>
              <td className="num">{free.taken}{free.pending > 0 && <small className="muted"> ({free.pending} pending)</small>}</td>
              <td className="num">{free.won}</td>
              <td className="num">{free.lost}</td>
              <td className="num">—</td>
              <td className="num">{ghs(free.valueWon)}</td>
              <td className="num">{ghs(free.moneyIn)}</td>
              <td className={`num${free.owed > 0 ? " owed" : ""}`}>{ghs(free.owed)}</td>
              <td className="num">—</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td><b>Everyone</b></td>
              <td className="num">{sum("open")}</td><td className="num">{sum("taken")}</td><td className="num">{sum("won")}</td><td className="num">{sum("lost")}</td>
              <td className="num">{pct(sum("won"), sum("won") + sum("lost"))}</td>
              <td className="num">{ghs(sum("valueWon"))}</td><td className="num">{ghs(sum("moneyIn"))}</td><td className="num">{ghs(sum("owed"))}</td><td className="num"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint" style={{ marginTop: "1rem", maxWidth: "80ch" }}>
        Taken, won and lost count requests received in the period. Money in counts payments dated in the period on each person&apos;s jobs. Open now and owed now are as of today.
        {best && best.valueWon > 0 ? ` Most value won in this period: ${best.name}.` : ""} Tap a name to see the requests they are handling.
      </p>
    </>
  );
}
