"use client";
import { useState } from "react";

/** Password field with a Show/Hide button. Accepts the usual input props. */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
    </span>
  );
}
