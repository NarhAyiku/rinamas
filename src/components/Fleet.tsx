"use client";
import { useState } from "react";
import Image from "next/image";
import { CATEGORIES, ghs, parseSpecs } from "@/lib/format";
import { openMachine } from "./MachineDialog";

/** What the browser gets for each machine. With prices hidden the page zeroes dayRate and operatorRate before sending. */
export type MachineCard = {
  id: string; slug: string; name: string; category: string; categoryLabel: string;
  image: string; specs: string; dayRate: number; rateUnit: string; operatorRate: number | null;
  available: boolean; priceOnRequest: boolean; selfDrive: boolean;
};

export function Fleet({ machines, showPrices = true }: { machines: MachineCard[]; showPrices?: boolean }) {
  const [filter, setFilter] = useState("all");
  const shown = machines.filter((m) => filter === "all" || m.category === filter);
  // A card opens the machine pop-up: big photo, every detail, and a request form for that machine.
  const pick = (m: MachineCard) => openMachine(m.slug);

  return (
    <>
      <div className="filters" role="group" aria-label="Filter fleet by job">
        {[["all", "All machines"], ...Object.entries(CATEGORIES)].map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      <div className="fleet">
        {shown.map((m) => (
          <article className="machine" id={`m-${m.slug}`} key={m.id} onClick={() => pick(m)} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") pick(m); }} aria-label={`${m.name}, see details and request`}>
            <div className="art">
              <Image src={m.image} alt={m.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 290px" style={{ objectFit: "cover" }} />
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
                {showPrices && !m.priceOnRequest ? (
                  <div>
                    <span className="from"><span className="long">{m.rateUnit === "trip" ? "From, per trip · Greater Accra" : "From, per day · machine only"}</span><span className="short">{m.rateUnit === "trip" ? "From / trip, Accra" : "From / day"}</span></span><br />
                    <b>{ghs(m.dayRate)}</b>
                  </div>
                ) : (
                  <div>
                    <span className="from">Per {m.rateUnit === "trip" ? "trip" : "day"}</span><br />
                    <b className="por">{m.priceOnRequest ? "Quoted per job" : "Price on request"}</b>
                  </div>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); pick(m); }}>{showPrices && !m.priceOnRequest ? "Details & quote →" : "Get today's rate →"}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
