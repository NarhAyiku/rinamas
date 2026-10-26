"use client";
import { useEffect, useRef } from "react";

const WORD = "RINAMAS";

export function BigType() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      const base = parseFloat(getComputedStyle(el).fontSize);
      const w = el.scrollWidth, cw = el.clientWidth;
      if (w > 0 && cw > 0) el.style.fontSize = `${(base * cw / w) * 0.992}px`;
    };
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(fit);
    window.addEventListener("resize", fit);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { el.classList.add("play"); io.disconnect(); } });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { window.removeEventListener("resize", fit); io.disconnect(); };
  }, []);

  return (
    <div className="bigtype-wrap">
      <div className="bigtype" ref={ref} aria-hidden="true">
        {WORD.split("").map((ch, i) => (
          <span className="ch" key={i} style={{ ["--i" as string]: i }}><i>{ch}</i></span>
        ))}
      </div>
    </div>
  );
}
