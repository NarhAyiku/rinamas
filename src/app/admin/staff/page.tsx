import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { setStaffActive } from "../actions";
import { StaffForms } from "./forms";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getSession();
  if (session?.role !== "superadmin") redirect("/admin?denied=1");
  const staff = await prisma.staff.findMany({ orderBy: [{ role: "desc" }, { createdAt: "asc" }], include: { _count: { select: { activities: true } } } });
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Management</p><h2>Staff accounts</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.4rem" }}>Admins run the dispatch desk: requests, hire records, hour logs and the fleet. Super admins see everything admins do, plus this page and the activity log.</p>
      <div className="tablewrap">
        <table className="compact">
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Last sign-in</th><th>Actions logged</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b></td><td className="num">{s.username}</td>
                <td><span className={`pill ${s.role === "superadmin" ? "pill-on_hire" : "pill-quoted"}`}><i aria-hidden="true" />{s.role === "superadmin" ? "Super admin" : "Admin"}</span></td>
                <td className="num">{s.lastLoginAt ? fmtDate(s.lastLoginAt) : "never"}</td>
                <td className="num">{s._count.activities}</td>
                <td>{s.active ? <span className="pill pill-confirmed"><i aria-hidden="true" />Active</span> : <span className="pill pill-closed"><i aria-hidden="true" />Deactivated</span>}</td>
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
      <StaffForms staff={staff.map((s) => ({ id: s.id, name: s.name, username: s.username }))} />
    </>
  );
}
