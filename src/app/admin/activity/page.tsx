import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const GROUPS: Record<string, string> = { "auth.": "Sign-ins", "quote.": "Requests & hires", "hourlog.": "Hour logs", "machine.": "Fleet", "staff.": "Staff" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ staff?: string; type?: string }> }) {
  const session = await getSession();
  if (session?.role !== "superadmin") redirect("/admin?denied=1");
  const { staff, type } = await searchParams;
  const where = { ...(staff ? { staffId: staff } : {}), ...(type ? { action: { startsWith: type } } : {}) };
  const [rows, people] = await Promise.all([
    prisma.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.staff.findMany({ orderBy: { name: "asc" } }),
  ]);
  const link = (p: { staff?: string; type?: string }) => { const u = new URLSearchParams(); if (p.staff) u.set("staff", p.staff); if (p.type) u.set("type", p.type); const s = u.toString(); return `/admin/activity${s ? `?${s}` : ""}`; };
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Management</p><h2>Activity</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.2rem" }}>Everything staff do on the desk, newest first: sign-ins, status changes, hire details, hour-log entries, fleet and rate edits, staff changes.</p>
      <div className="segmented" role="tablist" aria-label="Filter by person">
        <a role="tab" aria-selected={!staff} href={link({ type })}>Everyone</a>
        {people.map((p) => <a key={p.id} role="tab" aria-selected={staff === p.id} href={link({ staff: p.id, type })}>{p.name}</a>)}
      </div>
      <div className="segmented" role="tablist" aria-label="Filter by kind" style={{ marginTop: ".5rem" }}>
        <a role="tab" aria-selected={!type} href={link({ staff })}>All kinds</a>
        {Object.entries(GROUPS).map(([k, v]) => <a key={k} role="tab" aria-selected={type === k} href={link({ staff, type: k })}>{v}</a>)}
      </div>
      <ul className="activity" style={{ marginTop: "1.2rem" }}>
        {rows.length === 0 && <li className="muted">Nothing logged for this filter.</li>}
        {rows.map((a) => (
          <li key={a.id}>
            <time>{fmtDate(a.createdAt)}</time>
            <b>{a.actorName}</b>
            <span>{a.targetType === "quote" && a.targetId ? <a href={`/admin/requests/${a.targetId}`}>{a.summary}</a> : a.summary}</span>
            <small className="muted">{a.action}</small>
          </li>
        ))}
      </ul>
    </>
  );
}
