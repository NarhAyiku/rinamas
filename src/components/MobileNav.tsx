"use client";
import { useEffect, useState } from "react";
import { DISPATCH_PHONE } from "@/lib/contact";

const LINKS = [["/#fleet", "Fleet"], ["/#rates", "Rates"], ["/#how", "How it works"], ["/#coverage", "Coverage"], ["/#faq", "FAQ"]];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("nav-open"); };
  }, [open]);
  return (
    <>
      <button className="burger" type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
        <span /><span /><span />
      </button>
      <div id="mobile-menu" className="mobile-menu" hidden={!open}>
        <nav aria-label="Sections">
          {LINKS.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
        </nav>
        <div className="mobile-menu-cta">
          <a className="btn btn-accent" href="/#quote" onClick={() => setOpen(false)}>Request a quote</a>
          <a className="btn btn-ghost" href={`tel:${DISPATCH_PHONE.tel}`}>Call {DISPATCH_PHONE.display}</a>
        </div>
      </div>
    </>
  );
}
