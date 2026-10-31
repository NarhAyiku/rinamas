"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ghs, parseSpecs, waLink } from "@/lib/format";
import { ladder, type RateTable } from "@/lib/pricing";
import { DISPATCH_PHONE, WA_GREETING } from "@/lib/contact";
import { groupOf } from "@/data/catalogue";
import { QuoteForm } from "./QuoteForm";
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
    if (!ref.current?.open) ref.current?.showModal();
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
  const show = rates.showPrices && m && !m.priceOnRequest;
  const trip = m?.rateUnit === "trip";
  const lad = m && show && !trip ? ladder(m.dayRate, rates.rules) : null;

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
          <div className="mdlg-grid">
            <div className="mdlg-info">
              <div className="mdlg-photo">
                <Image key={m.image} src={m.image} alt={m.name} fill sizes="(max-width: 860px) 100vw, 560px" style={{ objectFit: "contain" }} />
              </div>
              <h2 id="mdlg-title">{m.name}</h2>
              <p className={`mdlg-avail ${m.available ? "is-in" : "is-out"}`}>{m.available ? "On the yard and ready to book" : "Out on hire now. Ask for your dates and we'll line it up."}</p>

              <div className="mdlg-price">
                {show && trip ? (
                  <>
                    <div><span>Per trip, Greater Accra</span><b>{ghs(m.dayRate)}</b></div>
                    {rates.zones.length > 0 && <div className="wide"><span>By zone, each way</span><em>{rates.zones.map((z) => `Zone ${z.name} ${ghs(z.lowBedEachWay)}`).join(" · ")}</em></div>}
                  </>
                ) : lad ? (
                  <>
                    <div><span>Day · {rates.rules.dayHours} h</span><b>{ghs(lad.day)}</b></div>
                    <div><span>Week · {rates.rules.weekDays} days</span><b>{ghs(lad.week)}</b></div>
                    <div><span>Month · {rates.rules.monthDays} days</span><b>{ghs(lad.month)}</b></div>
                    <div className="mdlg-op"><span>Our operator</span><b>{m.operatorRate ? `${ghs(m.operatorRate)} / day, if you want one` : "Included"}</b></div>
                  </>
                ) : (
                  <p className="mdlg-rate-call"><b>Today&apos;s rate. Your call.</b> Send the form and we&apos;ll reply with a written quote the same working day, or call <a href={`tel:${DISPATCH_PHONE.tel}`}>{DISPATCH_PHONE.display}</a> for a price now.</p>
                )}
              </div>

              <dl className="mdlg-specs">
                {parseSpecs(m.specs).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <ul className="mdlg-facts">
                <li>{trip ? "Comes with our driver; we load and secure your machine" : "With our operator or machine only, by the day, week or month"}</li>
                <li>{m.selfDrive ? "Drives to your site, so no low-bed charge" : "Delivered on our low bed from the N1 yard, priced by distance"}</li>
                <li>Insured, serviced by hour meter, and replaced if it is down for more than 24 hours</li>
              </ul>
            </div>

            <div className="mdlg-form">
              <p className="eyebrow">Request this machine</p>
              <h3>Tell us the job</h3>
              <p className="mdlg-form-sub">Dates, site and your number. Asking is free and commits you to nothing.</p>
              <QuoteForm machines={[]} rates={rates} fixedMachine={{ id: m.id, name: m.name }} idPrefix="d-" />
              <p className="mdlg-talk">Rather talk? <a href={`tel:${DISPATCH_PHONE.tel}`}>Call {DISPATCH_PHONE.display}</a> or <a href={waLink(wa, `${WA_GREETING} I'm interested in the ${m.name}.`)} target="_blank" rel="noopener">WhatsApp dispatch</a>.</p>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
