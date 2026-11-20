import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { AlertsForm, PasswordForm, SignOutOthersForm } from "./forms";
import { EMAIL_ALERTS_ENABLED, emailReady } from "@/lib/notify";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const s = await requireSession();
  // sign-ins, wrong passwords, locks and resets on this account: enough to notice someone else using it
  const me = await prisma.staff.findUnique({ where: { id: s.id }, select: { email: true, alerts: true } });
  const events = await prisma.activityLog.findMany({
    where: { OR: [
      { staffId: s.id, action: { startsWith: "auth." } },
      { targetType: "staff", targetId: s.id, action: { in: ["auth.fail", "auth.locked", "staff.password"] } },
    ] },
    orderBy: { createdAt: "desc" }, take: 15,
  });
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Account</p><h2>{s.name}</h2><p className="muted">Signed in as <b>{s.username}</b> · {s.role === "superadmin" ? "Super admin" : "Admin"}</p></div></div>
      <div className="grid-2">
        <div style={{ display: "grid", gap: "1.2rem", alignContent: "start" }}>
          {EMAIL_ALERTS_ENABLED && <AlertsForm email={me?.email ?? null} alerts={me?.alerts ?? true} ready={emailReady()} />}
          <PasswordForm />
        </div>
        <section className="panel">
          <h3>Sign-ins on this account</h3>
          <SignOutOthersForm />
          <ul className="activity signins" style={{ marginTop: "1rem" }}>
            {events.length === 0 && <li className="muted">Nothing recorded yet.</li>}
            {events.map((e) => (
              <li key={e.id} className={e.action === "auth.fail" || e.action === "auth.locked" ? "warn" : ""}>
                <time>{fmtDate(e.createdAt)}</time>
                <span>{e.summary}{e.actorName !== s.name && e.action === "staff.password" ? ` (by ${e.actorName})` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="hint" style={{ marginTop: "1rem" }}>Wrong passwords show here too. Five in a row locks the account for 15 minutes; the super admin can unlock it by setting a new password.</p>
        </section>
      </div>
    </>
  );
}
