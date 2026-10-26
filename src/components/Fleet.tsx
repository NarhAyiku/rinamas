"use client";
import { useState } from "react";
import { CATEGORIES, ghs, parseSpecs } from "@/lib/format";

export type MachineCard = {
  id: string; slug: string; name: string; category: string; categoryLabel: string;
  image: string; specs: string; dayRate: number; rateUnit: string; available: boolean;
};

export function Fleet({ machines }: { machines: MachineCard[] }) {
  const [filter, setFilter] = useState("all");
  const shown = machines.filter((m) => filter === "all" || m.category === filter);

  function pick(m: MachineCard) {
    const sel = document.getElementById("machine") as HTMLSelectElement | null;
    if (sel) sel.value = m.id;
    document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => sel?.focus(), 400);
  }

  return (
    <>
      <div className="filters" role="group" aria-label="Filter fleet by job">
        {[["all", "All machines"], ...Object.entries(CATEGORIES)].map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      <div className="fleet">
        {shown.map((m) => (
          <article className="machine" key={m.id}>
            <div className="art">
              <img src={m.image} alt={m.name} loading="lazy" width={1000} height={750} />
              {!m.available && <span className="unavailable">On hire · ask for dates</span>}
            </div>
            <div className="body">
              <span className="cat">{m.categoryLabel}</span>
              <h3>{m.name}</h3>
              <dl className="specs">
                {parseSpecs(m.specs).map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              <div className="rate">
                <div>
                  <span className="from">From, per {m.rateUnit === "trip" ? "trip (Greater Accra)" : "day"}</span><br />
                  <b>{ghs(m.dayRate)}</b>
                </div>
                <button type="button" onClick={() => pick(m)}>Add to quote</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
