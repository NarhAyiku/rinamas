"use client";
import { useEffect, useState } from "react";
import { DISPATCH_PHONE, WA_GREETING } from "@/lib/contact";
import { waLink } from "@/lib/format";

/** Two-action bar on phones: reach dispatch now, or request a quote. Appears once the hero scrolls off. */
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
    }, { threshold: 0.05 });
    if (hero) io.observe(hero);
    if (quote) io.observe(quote);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`stickybar ${show ? "show" : ""}`} aria-hidden={!show}>
      <a className="btn btn-wa" href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp</a>
      <a className="btn btn-ghost" href={`tel:${DISPATCH_PHONE.tel}`}>Call</a>
      <a className="btn btn-accent" href="/#quote">Get a quote</a>
    </div>
  );
}
