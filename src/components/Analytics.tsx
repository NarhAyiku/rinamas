"use client";
import { useEffect } from "react";
import { startAnalytics, track } from "@/lib/analytics";

/** Starts visitor analytics after the page is up and counts clicks on WhatsApp and phone links, wherever they are. */
export function Analytics() {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
    idle(() => { startAnalytics(); });
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!a) return;
      const where = a.closest("[class]")?.className.split(" ")[0] ?? null;
      if (a.href.startsWith("https://wa.me/")) track("whatsapp_click", { where, path: location.pathname });
      else if (a.href.startsWith("tel:")) track("call_click", { where, number: a.href.slice(4), path: location.pathname });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
