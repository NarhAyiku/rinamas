"use client";
import { usePathname } from "next/navigation";

export function AdminNav({ isSuper }: { isSuper: boolean }) {
  const path = usePathname();
  const cur = (p: string) => (path === p || (p !== "/admin" && path.startsWith(p)) ? "page" : undefined);
  return (
    <nav className="admin-nav wrap" aria-label="Admin sections">
      <a href="/admin" aria-current={cur("/admin")}>Requests</a>
      <a href="/admin/fleet" aria-current={cur("/admin/fleet")}>Fleet &amp; rates</a>
      {isSuper && <a href="/admin/activity" aria-current={cur("/admin/activity")}>Activity</a>}
      {isSuper && <a href="/admin/staff" aria-current={cur("/admin/staff")}>Staff</a>}
      <a href="/admin/account" aria-current={cur("/admin/account")}>My account</a>
      <a href="/" target="_blank" rel="noopener" className="ext">View site ↗</a>
    </nav>
  );
}
