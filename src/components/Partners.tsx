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
            <li key={p.url}>
              {/* The whole card is the link; its name is the company name (opens their site in a new tab). */}
              <a className="partner" href={p.url} target="_blank" rel="noopener">
                <span className="partner-logo">
                  {p.logo
                    ? <Image src={p.logo} alt="" fill sizes="(max-width: 640px) 80vw, 260px" />
                    : <span className="partner-word" aria-hidden="true">{p.name}</span>}
                </span>
                <span className="partner-body">
                  <span className="partner-rel">{RELATION[p.relation] ?? "Partner"}</span>
                  <span className="partner-name">{p.name}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11L11 5M6 4.5h5.5V10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <span className="partner-blurb">{p.blurb}</span>
                  <span className="partner-host">{new URL(p.url).hostname.replace(/^www\./, "")}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
