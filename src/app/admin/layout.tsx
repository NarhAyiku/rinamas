import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { BadgeDefs, Badge } from "@/components/Badge";
import { logout } from "./actions";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  const session = await getSession();
  if (!session && !path.startsWith("/admin/login")) redirect("/admin/login");
  if (!session) return <>{children}</>;
  const isSuper = session.role === "superadmin";
  const cur = (p: string) => (path === p || (p !== "/admin" && path.startsWith(p)) ? "page" : undefined);
  return (
    <div className="admin">
      <BadgeDefs />
      <header className="admin-head">
        <div className="wrap admin-head-row">
          <a className="brand" href="/admin"><Badge /><span className="name">RINAMAS<small>{isSuper ? "Management" : "Dispatch desk"}</small></span></a>
          <div className="admin-user">
            <span className="who"><b>{session.name}</b><small>{isSuper ? "Super admin" : "Admin"}</small></span>
            <form action={logout}><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </div>
        </div>
        <nav className="admin-nav wrap" aria-label="Admin sections">
          <a href="/admin" aria-current={cur("/admin")}>Requests</a>
          <a href="/admin/fleet" aria-current={cur("/admin/fleet")}>Fleet &amp; rates</a>
          {isSuper && <a href="/admin/activity" aria-current={cur("/admin/activity")}>Activity</a>}
          {isSuper && <a href="/admin/staff" aria-current={cur("/admin/staff")}>Staff</a>}
          <a href="/admin/account" aria-current={cur("/admin/account")}>My account</a>
          <a href="/" target="_blank" rel="noopener" className="ext">View site ↗</a>
        </nav>
      </header>
      <main className="wrap admin-main">{children}</main>
    </div>
  );
}
