"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="login-wrap">
      <form className="login panel" action={action}>
        <div className="login-brand"><img src="/brand/rinamas-badge.svg" alt="" width={56} height={50} /><div><p className="eyebrow">RINAMAS</p><h2>Dispatch desk</h2></div></div>
        <label className="f">Username<input name="username" autoComplete="username" autoCapitalize="none" required autoFocus /></label>
        <label className="f">Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <button className="btn btn-accent" type="submit" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
        <p className="hint" style={{ margin: 0 }}>Front desk and management accounts only. Ask the CEO for access.</p>
      </form>
    </main>
  );
}
