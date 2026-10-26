import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { BadgeDefs, Brand } from "@/components/Badge";
import { logout } from "./actions";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  const authed = await isAdmin();
  if (!authed && !path.startsWith("/admin/login")) redirect("/admin/login");
  if (!authed) return <>{children}</>;
  return (
    <>
      <BadgeDefs />
      <header className="top"><div className="wrap">
        <Brand />
        <nav className="admin-nav" style={{ color: "var(--steel-fg)" }}>
          <a href="/admin">Requests</a><a href="/admin/fleet">Fleet &amp; rates</a><a href="/" target="_blank" rel="noopener">View site ↗</a>
        </nav>
        <form action={logout}><button className="btn btn-ghost btn-sm" type="submit" style={{ color: "var(--steel-fg)" }}>Sign out</button></form>
      </div></header>
      <main className="wrap" style={{ paddingBlock: "2rem 4rem" }}>{children}</main>
    </>
  );
}
