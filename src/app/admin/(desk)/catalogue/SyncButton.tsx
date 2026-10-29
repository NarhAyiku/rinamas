"use client";
import { useActionState } from "react";
import type { CatalogueState } from "@/app/admin/actions";

type Action = (prev: CatalogueState, fd: FormData) => Promise<CatalogueState>;

/** One catalogue-sync action as a small form, so each row (and the apply-all button) reports its own result. */
export function SyncButton({ action, fields = {}, label, pendingLabel = "Working…", className = "btn btn-ghost btn-sm", confirm: confirmText, disabled = false }:
  { action: Action; fields?: Record<string, string>; label: string; pendingLabel?: string; className?: string; confirm?: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="sync-form" onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={className} type="submit" disabled={pending || disabled}>{pending ? pendingLabel : label}</button>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
    </form>
  );
}
