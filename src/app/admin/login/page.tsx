"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="wrap">
      <form className="login panel" action={action}>
        <p className="eyebrow">RINAMAS admin</p>
        <h2>Sign in</h2>
        <label className="f">Password<input name="password" type="password" autoComplete="current-password" required autoFocus /></label>
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        <button className="btn btn-accent" type="submit" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
      </form>
    </main>
  );
}
