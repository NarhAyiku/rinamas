"use client";
import { useState } from "react";

export function CopyButton({ text, className = "copy" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setDone(true); setTimeout(() => setDone(false), 1500);
  }
  return <button type="button" className={className} onClick={copy}>{done ? "Copied" : "Copy"}</button>;
}
