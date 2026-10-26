import { Brand } from "./Badge";
import { BigType } from "./BigType";
import credits from "@/data/credits.json";
import { DISPATCH_PHONE, MAPS_URL, OFFICE_PHONE } from "@/lib/contact";

export function Footer() {
  return (
    <footer>
      <div className="wrap cols-wrap">
        <div>
          <Brand />
          <p style={{ marginTop: ".8rem", maxWidth: "40ch" }}>
            RINAMAS Equipment and Trading Enterprise. Heavy-duty machine hire, haulage and operators for contractors across Ghana.
          </p>
        </div>
        <div className="cols">
          <div><b>Yard</b><a href={MAPS_URL} target="_blank" rel="noopener">Off N1 Highway</a><span>George Walker Bush Motorway, Accra</span></div>
          <div><b>Dispatch</b><a href={`tel:${DISPATCH_PHONE.tel}`}>{DISPATCH_PHONE.display}</a><a href={`tel:${OFFICE_PHONE.tel}`}>{OFFICE_PHONE.display}</a></div>
          <div><b>CEO</b><span>Narh Richard Mashie</span></div>
          <div><b>Site</b><a href="/#fleet">Fleet</a><a href="/#rates">Rates</a><a href="/#faq">FAQ</a><a href="/admin">Admin</a></div>
        </div>
      </div>
      <BigType />
      <div className="wrap bottombar">
        <p className="legal">© {new Date().getFullYear()} RINAMAS Equipment and Trading Enterprise · Off N1 Highway, George Walker Bush Motorway, Accra</p>
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
    </footer>
  );
}
