"use client";
import { useActionState } from "react";
import { changeOwnPassword } from "../actions";

export default function AccountPage() {
  const [state, action, pending] = useActionState(changeOwnPassword, undefined);
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Account</p><h2>Change my password</h2></div></div>
      <form className="panel" action={action} style={{ maxWidth: 460, display: "grid", gap: "1rem" }}>
        <label className="f">Current password<input name="current" type="password" autoComplete="current-password" required /></label>
        <label className="f">New password<input name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        {state?.ok && <p className="ok" role="status">{state.ok}</p>}
        <button className="btn btn-accent" type="submit" disabled={pending}>{pending ? "Saving…" : "Update password"}</button>
      </form>
    </>
  );
}
