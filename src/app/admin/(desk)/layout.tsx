import { requireSession } from "@/lib/auth";
import { BadgeDefs, Badge } from "@/components/Badge";
import { AdminNav } from "@/components/AdminNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { logout } from "@/app/admin/actions";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const isSuper = session.role === "superadmin";
  return (
    <div className="admin">
      <BadgeDefs />
      <header className="admin-head">
        <div className="wrap admin-head-row">
          <a className="brand" href="/admin"><Badge /><span className="name">RINAMAS<small>{isSuper ? "Management" : "Dispatch desk"}</small></span></a>
          <div className="admin-user">
            <span className="who"><b>{session.name}</b><small>{isSuper ? "Super admin" : "Admin"}</small></span>
            <ThemeToggle />
            <form action={logout}><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </div>
        </div>
        <AdminNav isSuper={isSuper} />
      </header>
      <main className="wrap admin-main">{children}</main>
    </div>
  );
}
