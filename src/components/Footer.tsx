import { Brand } from "./Badge";
import { BigType } from "./BigType";
import credits from "@/data/credits.json";
import { MACHINE_TYPES } from "@/data/catalogue";
import { waLink } from "@/lib/format";
import { DISPATCH_PHONE, MAPS_URL, OFFICE_PHONE, WA_GREETING, whatsappNumber } from "@/lib/contact";

/** Machine links in the footer: on the landing page they open the machine pop-up, elsewhere they load it via ?machine=. */
const HIRE = ["Excavators", "Payloaders", "Bulldozers", "Backhoes", "Tipper trucks", "Low beds", "Cranes"]
  .map((label) => MACHINE_TYPES.find((t) => t.label === label)!)
  .filter(Boolean);

export function Footer() {
  const wa = whatsappNumber();
  return (
    <footer>
      <div className="wrap">
        <div className="foot-cta">
          <div>
            <h2>Need a machine on site?</h2>
            <p>Tell us the job and we&apos;ll come back with today&apos;s rate, the same working day.</p>
          </div>
          <div className="foot-cta-btns">
            <a className="btn btn-accent" href="/#quote">Request a quote</a>
            <a className="btn btn-wa" href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div>

        <div className="foot-grid">
          <div className="foot-brand">
            <Brand />
            <p>Heavy-machine hire, haulage and operators for contractors across Ghana, from our yard off the N1 in Accra.</p>
            <p className="foot-ceo"><span>CEO</span>Narh Richard Mashie</p>
          </div>
          <nav className="foot-col" aria-label="Machines">
            <b>Hire</b>
            {HIRE.map((t) => (
              <a key={t.label} href={`/?machine=${t.slug}`} data-open-machine={(t.slugs ?? [t.slug]).join(",")} data-pick={t.slug}>{t.label}</a>
            ))}
            <a href="/#fleet" className="foot-more">All machines →</a>
          </nav>
          <div className="foot-col">
            <b>Talk to dispatch</b>
            <a className="foot-phone" href={`tel:${DISPATCH_PHONE.tel}`}>{DISPATCH_PHONE.display}</a>
            <a className="foot-phone" href={`tel:${OFFICE_PHONE.tel}`}>{OFFICE_PHONE.display}</a>
            <a href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp {DISPATCH_PHONE.display}</a>
            <span className="foot-hours">Mon–Sat, 06:00–18:00</span>
          </div>
          <div className="foot-col">
            <b>The yard</b>
            <span>Off N1 Highway<br />George Walker Bush Motorway<br />Accra, Ghana</span>
            <a href={MAPS_URL} target="_blank" rel="noopener">Open in Google Maps ↗</a>
          </div>
          <nav className="foot-col" aria-label="Site">
            <b>Explore</b>
            <a href="/#rates">Rates</a>
            <a href="/#how">How hire works</a>
            <a href="/#coverage">Coverage</a>
            <a href="/#partners">Partners</a>
            <a href="/#faq">Questions</a>
          </nav>
        </div>
      </div>
      <BigType />
      <div className="wrap bottombar">
        <p className="legal">© {new Date().getFullYear()} RINAMAS Equipment and Trading Enterprise</p>
        <div className="bottom-links">
          <a href="/admin">Staff login</a>
          <details className="credits">
            <summary>Photo credits</summary>
            <ul>
              {credits.map((c) => (
                <li key={c.key}>
                  {c.label}: <a href={c.page} target="_blank" rel="noopener">{c.title}</a> by {c.artist}, {c.license}, via Wikimedia Commons
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </footer>
  );
}
