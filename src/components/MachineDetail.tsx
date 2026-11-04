import Image from "next/image";
import { ghs, parseSpecs, waLink } from "@/lib/format";
import { ladder, type RateTable } from "@/lib/pricing";
import { DISPATCH_PHONE, WA_GREETING } from "@/lib/contact";
import { QuoteForm } from "./QuoteForm";
import type { MachineCard } from "./Fleet";

/**
 * One machine in full: photo, availability, the price picture, specs, what's included, and a request form for it.
 * Shared by the machine pop-up and the /hire/[slug] page, so both always show the same thing.
 */
export function MachineDetail({ m, rates, wa, title, titleId, Heading = "h2", idPrefix = "d-", formId, priority = false }: {
  m: MachineCard; rates: RateTable; wa: string; title?: string; titleId?: string; Heading?: "h1" | "h2"; idPrefix?: string; formId?: string; priority?: boolean;
}) {
  const show = rates.showPrices && !m.priceOnRequest;
  const trip = m.rateUnit === "trip";
  const lad = show && !trip ? ladder(m.dayRate, rates.rules) : null;

  return (
    <div className="mdlg-grid">
      <div className="mdlg-info">
        <div className="mdlg-photo">
          <Image key={m.image} src={m.image} alt={m.name} fill sizes="(max-width: 860px) 100vw, 560px" style={{ objectFit: "contain" }} priority={priority} />
        </div>
        <Heading id={titleId}>{title ?? m.name}</Heading>
        <p className={`mdlg-avail ${m.available ? "is-in" : "is-out"}`}>{m.available ? "On the yard and ready to book" : "Out on hire now. Ask for your dates and we'll line it up."}</p>

        <div className="mdlg-price">
          {show && trip ? (
            <>
              <div><span>Per trip, Greater Accra</span><b>{ghs(m.dayRate)}</b></div>
              {rates.zones.length > 0 && <div className="wide"><span>By zone, each way</span><em>{rates.zones.map((z) => `Zone ${z.name} ${ghs(z.lowBedEachWay)}`).join(" · ")}</em></div>}
            </>
          ) : lad ? (
            <>
              <div><span>Day · {rates.rules.dayHours} h</span><b>{ghs(lad.day)}</b></div>
              <div><span>Week · {rates.rules.weekDays} days</span><b>{ghs(lad.week)}</b></div>
              <div><span>Month · {rates.rules.monthDays} days</span><b>{ghs(lad.month)}</b></div>
              <div className="mdlg-op"><span>Our operator</span><b>{m.operatorRate ? `${ghs(m.operatorRate)} / day, if you want one` : "Included"}</b></div>
            </>
          ) : (
            <p className="mdlg-rate-call"><b>Today&apos;s rate. Your call.</b> Send the form and we&apos;ll reply with a written quote the same working day, or call <a href={`tel:${DISPATCH_PHONE.tel}`}>{DISPATCH_PHONE.display}</a> for a price now.</p>
          )}
        </div>

        <dl className="mdlg-specs">
          {parseSpecs(m.specs).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <ul className="mdlg-facts">
          <li>{trip ? "Comes with our driver; we load and secure your machine" : "With our operator or machine only, by the day, week or month"}</li>
          <li>{m.selfDrive ? "Drives to your site, so no low-bed charge" : "Delivered on our low bed from the N1 yard, priced by distance"}</li>
          <li>Insured, serviced by hour meter, and replaced if it is down for more than 24 hours</li>
        </ul>
      </div>

      <div className="mdlg-form" id={formId}>
        <p className="eyebrow">Request this machine</p>
        <h3>Tell us the job</h3>
        <p className="mdlg-form-sub">Dates, site and your number. Asking is free and commits you to nothing.</p>
        <QuoteForm machines={[]} rates={rates} fixedMachine={{ id: m.id, name: m.name }} idPrefix={idPrefix} />
        <p className="mdlg-talk">Rather talk? <a href={`tel:${DISPATCH_PHONE.tel}`}>Call {DISPATCH_PHONE.display}</a> or <a href={waLink(wa, `${WA_GREETING} I'm interested in the ${m.name}.`)} target="_blank" rel="noopener">WhatsApp dispatch</a>.</p>
      </div>
    </div>
  );
}
