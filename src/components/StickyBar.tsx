"use client";
import { useEffect, useState } from "react";
import { DISPATCH_PHONE, WA_GREETING } from "@/lib/contact";
import { waLink } from "@/lib/format";
import { openChat } from "@/lib/chat-event";

/** Action bar on phones: reach dispatch now, ask the chat, or request a quote. Appears once the hero (#top) scrolls off
 *  and hides while the page's request form (#quote) is in view; every page that renders it has both. Once the hero is
 *  gone, body.hero-gone hides the floating chat button on phones; the Ask slot shows only when the chat is on the page. */
export function StickyBar({ wa }: { wa: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("top");
    const quote = document.getElementById("quote");
    let heroGone = false, quoteVisible = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) heroGone = !e.isIntersecting;
        if (e.target === quote) quoteVisible = e.isIntersecting;
      }
      setShow(heroGone && !quoteVisible);
      document.body.classList.toggle("hero-gone", heroGone);
    }, { threshold: 0.05 });
    if (hero) io.observe(hero);
    if (quote) io.observe(quote);
    return () => { io.disconnect(); document.body.classList.remove("hero-gone"); };
  }, []);
  return (
    <div className={`stickybar ${show ? "show" : ""}`} aria-hidden={!show}>
      <a className="btn btn-wa" href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp</a>
      <a className="btn btn-ghost" href={`tel:${DISPATCH_PHONE.tel}`}>Call</a>
      <button type="button" className="btn btn-ghost sb-ask" onClick={openChat}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /></svg>Ask
      </button>
      <a className="btn btn-accent" href="#quote">Get a quote</a>
    </div>
  );
}
