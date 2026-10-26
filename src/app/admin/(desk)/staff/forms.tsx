"use client";
import { useActionState } from "react";
import { createStaff, resetStaffPassword } from "@/app/admin/actions";
import { PasswordInput } from "@/components/PasswordInput";

export function StaffForms({ staff }: { staff: { id: string; name: string; username: string }[] }) {
  const [c, createAction, creating] = useActionState(createStaff, undefined);
  const [r, resetAction, resetting] = useActionState(resetStaffPassword, undefined);
  return (
    <div className="grid-2" style={{ marginTop: "1.4rem" }}>
      <form className="panel" action={createAction} style={{ display: "grid", gap: ".9rem" }}>
        <h3>Add a staff account</h3>
        <div className="inline-form">
          <label className="f">Full name<input name="name" required /></label>
          <label className="f">Username<input name="username" pattern="[a-z0-9._-]{3,30}" autoCapitalize="none" required /></label>
          <label className="f">Role<select name="role" defaultValue="admin"><option value="admin">Admin (front desk)</option><option value="superadmin">Super admin</option></select></label>
          <label className="f">Temporary password<PasswordInput name="password" minLength={8} autoComplete="new-password" required /></label>
        </div>
        {c?.error && <p className="err" role="alert">{c.error}</p>}
        {c?.ok && <p className="ok" role="status">{c.ok}</p>}
        <div><button className="btn btn-accent btn-sm" type="submit" disabled={creating}>{creating ? "Creating…" : "Create account"}</button></div>
      </form>
      <form className="panel" action={resetAction} style={{ display: "grid", gap: ".9rem", alignContent: "start" }}>
        <h3>Reset a password</h3>
        <div className="inline-form">
          <label className="f">Account<select name="id" required>{staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.username})</option>)}</select></label>
          <label className="f">New password<PasswordInput name="password" minLength={8} autoComplete="new-password" required /></label>
        </div>
        {r?.error && <p className="err" role="alert">{r.error}</p>}
        {r?.ok && <p className="ok" role="status">{r.ok}</p>}
        <div><button className="btn btn-ghost btn-sm" type="submit" disabled={resetting}>{resetting ? "Saving…" : "Set password"}</button></div>
      </form>
    </div>
  );
}
