import { waLink } from "@/lib/format";
import { DISPATCH_PHONE, MAPS_URL, OFFICE_PHONE, WA_GREETING } from "@/lib/contact";
import type { RateTable } from "@/lib/pricing";
import { QuoteForm } from "./QuoteForm";
import { CopyButton } from "./CopyButton";

/** The yellow "Get a quote today" band: direct contacts beside the request form. Every public page ends with it. */
export function QuoteBand({ machines, rates, wa, title = "Get a quote today" }: { machines: { id: string; name: string }[]; rates: RateTable; wa: string; title?: string }) {
  return (
    <section className="band quote" id="quote">
      <div className="wrap">
        <div>
          <p className="eyebrow">Dispatch</p>
          <h2 style={{ marginTop: ".5rem" }}>{title}</h2>
          <p className="lede">Send the form and dispatch has it straight away, with a reference number and a one-tap WhatsApp follow-up. Asking is free and commits you to nothing. Or reach us directly on the numbers here.</p>
          <div className="contact">
            <div className="contact-row"><span className="lbl">WhatsApp</span><a className="code" href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">{DISPATCH_PHONE.display}</a><CopyButton text={DISPATCH_PHONE.tel} /></div>
            <div className="contact-row"><span className="lbl">Call</span><a className="code" href={`tel:${OFFICE_PHONE.tel}`}>{OFFICE_PHONE.display}</a><CopyButton text={OFFICE_PHONE.tel} /></div>
            <div className="contact-row"><span className="lbl">Yard</span><a className="code" href={MAPS_URL} target="_blank" rel="noopener">Accra-Tema Motorway, Accra ↗</a></div>
          </div>
        </div>
        <QuoteForm machines={machines.map((m) => ({ id: m.id, name: m.name }))} rates={rates} />
      </div>
    </section>
  );
}
