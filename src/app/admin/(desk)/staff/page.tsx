import { prisma } from "@/lib/db";
import { requireSuper } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { setStaffActive } from "@/app/admin/actions";
import { StaffForms } from "./forms";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireSuper();
  const now = new Date();
  const staff = await prisma.staff.findMany({ orderBy: [{ role: "desc" }, { createdAt: "asc" }], include: { _count: { select: { activities: true, handling: { where: { status: { in: ["new", "quoted", "confirmed", "on_hire"] } } } } } } });
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Management</p><h2>Staff accounts</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.4rem" }}>Admins run the dispatch desk: requests, hire records, hour logs and the fleet. Super admins see everything admins do, plus finance, this page and the full activity log. Everyone sees who did what on each hire record. Setting a new password also unlocks an account and signs it out on every device.</p>
      <div className="tablewrap">
        <table className="compact">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Last sign-in</th><th>Alert email</th><th>Handling now</th><th>Actions logged</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b></td><td className="num">{s.username}</td>
                <td><span className={`pill ${s.role === "superadmin" ? "pill-on_hire" : "pill-quoted"}`}><i aria-hidden="true" />{s.role === "superadmin" ? "Super admin" : "Admin"}</span></td>
                <td className="num">{s.lastLoginAt ? fmtDate(s.lastLoginAt) : "never"}</td>
                <td>{s.email ? <span className={s.alerts ? "" : "muted"} title={s.alerts ? "Alerts on" : "Alerts turned off by them"}>{s.email}{s.alerts ? "" : " (off)"}</span> : <span className="muted">none</span>}</td><td className="num">{s._count.handling}</td><td className="num">{s._count.activities}</td>
                <td>{!s.active ? <span className="pill pill-closed"><i aria-hidden="true" />Deactivated</span>
                  : s.lockedUntil && s.lockedUntil > now ? <span className="pill pill-lost" title="Too many wrong passwords. Set a new password below to unlock now."><i aria-hidden="true" />Locked to {fmtDate(s.lockedUntil)}</span>
                  : <span className="pill pill-confirmed"><i aria-hidden="true" />Active</span>}</td>
                <td>
                  {s.id !== session.id && (
                    <form action={setStaffActive}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={s.active ? "0" : "1"} />
                      <button className={`link ${s.active ? "danger" : ""}`} type="submit">{s.active ? "Deactivate" : "Reactivate"}</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StaffForms staff={staff.map((s) => ({ id: s.id, name: s.name, username: s.username, email: s.email }))} />
    </>
  );
}
