"use client";
import { useActionState } from "react";
import { changeOwnPassword, signOutOtherDevices } from "@/app/admin/actions";
import { PasswordInput } from "@/components/PasswordInput";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, undefined);
  return (
    <form className="panel" action={action} style={{ display: "grid", gap: "1rem", alignContent: "start" }}>
      <h3 style={{ margin: 0 }}>Change my password</h3>
      <label className="f">Current password<PasswordInput name="current" autoComplete="current-password" required /></label>
      <label className="f">New password<PasswordInput name="next" autoComplete="new-password" minLength={8} required /></label>
      <p className="hint" style={{ margin: 0 }}>Changing it signs you out on every other phone and computer. This one stays signed in.</p>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      <div><button className="btn btn-accent" type="submit" disabled={pending}>{pending ? "Saving…" : "Update password"}</button></div>
    </form>
  );
}

export function SignOutOthersForm() {
  const [state, action, pending] = useActionState(signOutOtherDevices, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: ".6rem" }}>
      <p className="muted" style={{ margin: 0 }}>Left the desk signed in on a shared computer, or see a sign-in below that wasn&apos;t you? Sign out everywhere else, then change your password.</p>
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      <div><button className="btn btn-ghost btn-sm" type="submit" disabled={pending}>{pending ? "Signing out…" : "Sign out my other devices"}</button></div>
    </form>
  );
}
