"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RateTable } from "@/lib/pricing";
import { groupOf } from "@/data/catalogue";
import { MachineDetail } from "./MachineDetail";
import { track } from "@/lib/analytics";
import type { MachineCard } from "./Fleet";

const EVENT = "rinamas:machine";

/** Open the machine pop-up from anywhere on the landing page. `slugs` become tabs (several sizes of one kind). */
export function openMachine(pick: string, slugs: string[] = groupOf(pick)) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { pick, slugs } }));
}

/**
 * The machine pop-up: large photo, every spec, the price picture, and a request form for that machine.
 * Opened by fleet cards, by any link carrying data-open-machine="slug[,slug]" (type tiles, footer), or by
 * /?machine=slug, so a link to one machine can be shared. Opening pushes a history entry, so the phone's back
 * button closes the pop-up instead of leaving the site.
 */
export function MachineDialog({ machines, rates, wa }: { machines: MachineCard[]; rates: RateTable; wa: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pushed = useRef(false);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const bySlug = useCallback((s: string) => machines.find((m) => m.slug === s), [machines]);

  const open = useCallback((pick: string, group: string[]) => {
    const tabs = group.filter((s) => bySlug(s));
    const first = bySlug(pick) ? pick : tabs[0];
    if (!first) return false;
    setSlugs(tabs.length ? tabs : [first]);
    setSlug(first);
    if (!ref.current?.open) { ref.current?.showModal(); track("machine_dialog_open", { machine: first, path: location.pathname }); }
    const url = `${location.pathname}?machine=${first}`;
    if (pushed.current) history.replaceState(history.state, "", url);
    else { history.pushState(history.state, "", url); pushed.current = true; }
    return true;
  }, [bySlug]);

  const finish = useCallback(() => {
    if (ref.current?.open) ref.current.close();
    setSlug(null);
  }, []);

  // Close through history when we added an entry, so back and the close button behave the same.
  const requestClose = useCallback(() => {
    if (pushed.current) history.back();
    else { finish(); history.replaceState(history.state, "", location.pathname + location.hash); }
  }, [finish]);

  useEffect(() => {
    const onEvent = (e: Event) => { const d = (e as CustomEvent<{ pick: string; slugs: string[] }>).detail; open(d.pick, d.slugs); };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-open-machine]");
      if (!a) return;
      const group = a.dataset.openMachine!.split(",");
      if (open(a.dataset.pick ?? group[0], group)) e.preventDefault();
    };
    const onPop = () => { if (pushed.current) { pushed.current = false; finish(); } };
    window.addEventListener(EVENT, onEvent);
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    // Shared link: /?machine=lowbed opens straight onto that machine.
    const wanted = new URLSearchParams(location.search).get("machine");
    if (wanted && bySlug(wanted)) {
      history.replaceState(history.state, "", location.pathname + location.hash);
      open(wanted, groupOf(wanted));
    }
    return () => {
      window.removeEventListener(EVENT, onEvent);
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
    };
  }, [open, finish, bySlug]);

  // Pick a different size: swap the machine in place and keep whatever the visitor already typed.
  const switchTo = (s: string) => {
    setSlug(s);
    history.replaceState(history.state, "", `${location.pathname}?machine=${s}`);
    ref.current?.querySelector(".mdlg-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const m = slug ? bySlug(slug) : undefined;

  return (
    <dialog
      ref={ref}
      className="mdlg"
      aria-labelledby="mdlg-title"
      onCancel={(e) => { e.preventDefault(); requestClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      {m && (
        <div className="mdlg-scroll">
          <div className="mdlg-bar">
            <span className="mdlg-cat">{m.categoryLabel}</span>
            <button type="button" className="mdlg-x" onClick={requestClose} aria-label="Close">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </button>
          </div>
          {slugs.length > 1 && (
            <div className="mdlg-tabs" role="group" aria-label="Choose a size">
              {slugs.map((s) => (
                <button key={s} type="button" className="chip" aria-pressed={s === slug} onClick={() => switchTo(s)}>{bySlug(s)!.name}</button>
              ))}
            </div>
          )}
          <MachineDetail m={m} rates={rates} wa={wa} titleId="mdlg-title" />
        </div>
      )}
    </dialog>
  );
}
