import Image from "next/image";
import partners from "@/data/partners.json";

type Partner = { name: string; url: string; blurb: string; logo: string | null; relation: "client" | "partner" | "supplier" };

const RELATION: Record<Partner["relation"], string> = { client: "Client", partner: "Partner", supplier: "Supplier" };

/** "Companies we work with" band. Add a company: one entry in src/data/partners.json plus its logo in public/partners/. */
export function Partners() {
  const list = partners as Partner[];
  if (!list.length) return null;
  return (
    <section className="band" id="partners">
      <div className="wrap">
        <div className="head"><div>
          <p className="eyebrow">Trusted by</p>
          <h2 style={{ marginTop: ".5rem" }}>Companies we work with</h2>
          <p className="lede">Ghanaian businesses we work alongside and trust. Good people to know; take a look at what they do.</p>
        </div></div>
        <ul className="partners">
          {list.map((p) => (
            <li className="partner" key={p.url}>
              <div className="partner-logo">
                {p.logo
                  ? <Image src={p.logo} alt={p.name} fill sizes="(max-width: 640px) 80vw, 260px" />
                  : <span className="partner-word">{p.name}</span>}
              </div>
              <div className="partner-body">
                <span className="partner-rel">{RELATION[p.relation] ?? "Partner"}</span>
                <h3>{p.name}</h3>
                <p>{p.blurb}</p>
                <a href={p.url} target="_blank" rel="noopener">Visit {p.name} ↗</a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
