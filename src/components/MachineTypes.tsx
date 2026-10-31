import Image from "next/image";
import { MACHINE_TYPES } from "@/data/catalogue";

/** Photo tiles for every kind of machine RINAMAS hires, near the top of the landing page so visitors see the range at once.
 *  Each tile opens the machine pop-up (MachineDialog listens for data-open-machine) with every size of that kind as tabs. */
export function MachineTypes() {
  return (
    <section className="types" aria-label="Machines we hire">
      <div className="wrap">
        <div className="types-head">
          <p className="eyebrow">What we hire</p>
          <h2>Pick a machine</h2>
          <p className="types-sub">Tap a machine for photos, specs and a quick request.</p>
        </div>
        <ul className="types-row">
          {MACHINE_TYPES.map((t) => (
            <li key={t.label}>
              <a href={`/?machine=${t.slug}`} data-open-machine={(t.slugs ?? [t.slug]).join(",")} data-pick={t.slug}>
                <span className="types-photo">
                  <Image src={t.image} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 190px" style={{ objectFit: "cover", objectPosition: t.objectPosition ?? "50% 55%" }} />
                </span>
                <span className="types-label">{t.label}</span>
              </a>
            </li>
          ))}
          <li className="types-more"><a href="#quote">Something else? <b>Ask dispatch</b></a></li>
        </ul>
      </div>
    </section>
  );
}
