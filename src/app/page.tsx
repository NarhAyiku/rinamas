import { ghs, waLink } from "@/lib/format";
import { DISPATCH_PHONE, MAPS_URL, OFFICE_PHONE, WA_GREETING } from "@/lib/contact";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Fleet } from "@/components/Fleet";
import { QuoteBand } from "@/components/QuoteBand";
import { StickyBar } from "@/components/StickyBar";
import { MachineTypes } from "@/components/MachineTypes";
import { Partners } from "@/components/Partners";
import { MachineDialog } from "@/components/MachineDialog";
import Image from "next/image";
import { fmtReviewed } from "@/lib/settings";
import { ladder } from "@/lib/pricing";
import { loadPublic } from "@/lib/public-data";
import { REGIONS } from "@/data/regions";
import { faqItems } from "@/data/faq";
import { businessJsonLd, faqJsonLd, JsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const { machines, pricing, zones, cards, rates, wa } = await loadPublic();
  const reviewed = fmtReviewed(pricing.reviewedAt);
  const lad = (d: number) => ladder(d, pricing);
  const lastZone = zones[zones.length - 1];
  const faq = faqItems(pricing);

  return (
    <>
      <Header />
      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden="true" />
        <div className="wrap">
          <div className="hero-copy">
            <h1 className="hero-name"><span className="n1">RINAMAS</span><span className="n2">Equipment &amp;&nbsp;Trading Enterprise</span></h1>
            <p className="hero-sub">Heavy-machine hire, haulage and operators across Ghana. JCB first.</p>
            <div className="cta">
              <a className="btn btn-accent" href="#quote">Request a quote</a>
              <a className="btn btn-ghost" href={`tel:${DISPATCH_PHONE.tel}`}>Call {DISPATCH_PHONE.display}</a>
              <a className="btn btn-wa" href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp</a>
            </div>
          </div>
          <div className="hero-art"><Image src="/img/hero-loadall.jpg" alt="JCB 527-58 Loadall telehandler with bucket lowered, ready to work" width={1600} height={931} priority sizes="(max-width: 860px) 100vw, 45vw" /></div>
        </div>
      </section>
      <MachineTypes />
      <div className="stripe" aria-hidden="true" />
      <section className="stats" aria-label="At a glance">
        <div className="wrap">
          <div className="stat"><b>{machines.length}</b><span>Machine classes on the yard</span></div>
          <div className="stat"><b>N1</b><span>Yard on the George Walker Bush Motorway</span></div>
          <div className="stat"><b>24h</b><span>Usual delivery, Greater Accra</span></div>
          <div className="stat"><b>10</b><span>Regions served</span></div>
        </div>
      </section>

      <section className="band" id="fleet">
        <div className="wrap">
          <div className="head"><div>
            <p className="eyebrow">Spec sheet</p>
            <h2 style={{ marginTop: ".5rem" }}>What&apos;s on the yard</h2>
            <p className="lede">Every machine below comes with or without an operator, by the day, week or month: you choose. {pricing.showPrices ? "Rates shown are guide day rates in Ghana cedis for the machine alone." : "Tap any machine and we'll send you today's rate for your job."} Tap a card to check dates and add it to your request.</p>
          </div></div>
          <Fleet machines={cards} showPrices={pricing.showPrices} />
          <p className="note pricing-note"><b>{pricing.showPrices ? "About these rates." : "About pricing."}</b> {pricing.note}{reviewed ? ` Rates last reviewed ${reviewed}${pricing.usdRate ? ` at GH₵ ${pricing.usdRate} to the dollar` : ""}.` : ""}</p>
          <p className="note">Longer hires cost less per day: a week is {pricing.weekDays} days at {pricing.weekDiscountPct}% off and a month is {pricing.monthDays} days at {pricing.monthDiscountPct}% off, and you always get whichever works out cheaper. Operator, fuel and transport are yours to add or leave out.</p>
        </div>
      </section>

      <section className="band band-surface" id="rates">
        <div className="wrap">
          <div className="head"><div>
            <p className="eyebrow">{pricing.showPrices ? "Rate card" : "Your rate"}</p>
            <h2 style={{ marginTop: ".5rem" }}>{pricing.showPrices ? "Day, week or month" : "Today's rate. Your call."}</h2>
            <p className="lede">{pricing.showPrices ? "The longer you keep the machine, the less you pay per day. These are guide figures in Ghana cedis; your written quote confirms them and locks your rate for the hire." : "You get a live price, never a stale one. Tell us the machine, dates and site and we'll send a written quote the same working day. Once you accept it, that rate is yours for the whole hire, even if the dollar moves."}</p>
          </div></div>
          {!pricing.showPrices && (
            <div className="price-call">
              <div><b>Call dispatch</b><a href={`tel:${DISPATCH_PHONE.tel}`}>{DISPATCH_PHONE.display}</a></div>
              <div><b>WhatsApp</b><a href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">{DISPATCH_PHONE.display}</a></div>
              <div><b>Or online</b><a href="#quote">Request a written quote →</a></div>
            </div>
          )}
          {pricing.showPrices && <p className="swipe-hint">Swipe the table for week and month rates →</p>}
          {pricing.showPrices && <div className="tablewrap">
            <table>
              <thead><tr><th>Machine class</th><th>Day ({pricing.dayHours} h)</th><th>Week ({pricing.weekDays} days)</th><th>Month ({pricing.monthDays} days)</th><th>Operator / day</th></tr></thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className="num">{m.priceOnRequest ? "On request" : `${ghs(m.dayRate)}${m.rateUnit === "trip" ? " / trip" : ""}`}</td>
                    {m.priceOnRequest ? <td className="num" colSpan={2}>Quoted per job after a site call</td> : m.rateUnit === "trip"
                      ? <td className="num" colSpan={2}>{zones.length ? `${zones.map((z) => `Zone ${z.name} ${ghs(z.lowBedEachWay)}`).join(" · ")} each way` : "Priced by distance from the yard"}</td>
                      : <><td className="num">{ghs(lad(m.dayRate).week)}</td><td className="num">{ghs(lad(m.dayRate).month)}</td></>}
                    <td className="num">{m.operatorRate ? ghs(m.operatorRate) : "Included"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          {pricing.showPrices && zones.length > 0 && (
            <div className="zone-strip">
              <h3>Low bed to your site, each way</h3>
              <p className="hint" style={{ margin: 0 }}>Tracked machines ride to your site on our low bed from the N1 yard. Prices are one way; delivery and collection are two trips, both shown in your estimate.</p>
              <ul>
                {zones.map((z) => (
                  <li key={z.id}><b>Zone {z.name}</b><span>within {z.maxKm} km · {z.towns}</span><em>{ghs(z.lowBedEachWay)}</em></li>
                ))}
                <li><b>Further</b><span>beyond {lastZone?.maxKm ?? 120} km · Kumasi, Takoradi, Ho, Tamale</span><em>{ghs(pricing.perKmBeyond)} / km, quoted</em></li>
              </ul>
            </div>
          )}
          <div className="incl">
            <div><b>Included in every hire</b><ul><li>Scheduled servicing, logged by hour meter</li><li>Comprehensive insurance and site induction papers</li><li>Standby replacement if a unit goes down for more than 24 hours</li><li>Pre-start checks and PPE for crewed hires</li></ul></div>
            <div><b>Add what you need</b><ul><li>Diesel delivered to site, billed on the hours worked</li><li>Our operator, so you don&apos;t need to find your own</li><li>Low-bed transport to and from your site, priced by distance</li><li>Attachments: breaker, ripper, long-reach boom</li></ul></div>
          </div>
        </div>
      </section>

      <section className="band" id="how">
        <div className="wrap">
          <div className="head"><div><p className="eyebrow">How hire works</p><h2 style={{ marginTop: ".5rem" }}>From request to iron on site</h2></div></div>
          <div className="steps">
            <div className="step"><span className="n"><em>01</em> Step 1</span><h3>Send the job</h3><p>Tell us the machine, dates and site, and whether you want an operator and fuel. WhatsApp, call or use the form below, whichever suits you.</p></div>
            <div className="step"><span className="n"><em>02</em> Step 2</span><h3>Your quote, your call</h3><p>You get a written quote within the working day. When you&apos;re happy, a deposit by MoMo or bank transfer holds the machine and your date.</p></div>
            <div className="step"><span className="n"><em>03</em> Step 3</span><h3>We deliver</h3><p>We load your machine onto our low bed at the N1 yard. Greater Accra sites usually have it within 24 hours; other regions within 48.</p></div>
            <div className="step"><span className="n"><em>04</em> Step 4</span><h3>Work &amp; settle</h3><p>Hours come off the machine&apos;s meter and your site agent signs them each day, so the bill matches exactly what you signed.</p></div>
          </div>
        </div>
      </section>

      <section className="band band-surface" id="coverage">
        <div className="wrap">
          <div className="head"><div>
            <p className="eyebrow">Coverage</p>
            <h2 style={{ marginTop: ".5rem" }}>One yard, nationwide reach</h2>
            <p className="lede">Every machine leaves from our yard off the N1 Highway in Accra and reaches sites across the country. Transport is a set price by zone around Accra and by distance beyond it.</p>
          </div></div>
          <figure className="photo-band"><Image src="/img/ghana.jpg" alt="Excavator on drainage works in Ghana" width={1600} height={1067} sizes="(max-width: 1180px) 100vw, 1180px" /><figcaption>Excavator on drainage works, Ghana</figcaption></figure>
          <div className="cover">
            <div className="regions">
              {REGIONS.map((r) => <a className="region" key={r.slug} href={`/regions/${r.slug}`}><span className="dot" /><div><b>{r.name}</b><span>{r.towns.slice(0, 4).join(", ")}{r.slug === "northern-savannah" ? ", on request" : ""}</span></div></a>)}
            </div>
            <div className="depot">
              <h3>The yard</h3>
              <dl>
                <dt>Address</dt><dd>RINAMAS Equipment and Trading Enterprise<br />Off N1 Highway, George Walker Bush Motorway<br />Accra, Ghana<br /><a className="maplink" href={MAPS_URL} target="_blank" rel="noopener">Open in Google Maps ↗</a></dd>
                <dt>CEO</dt><dd>Narh Richard Mashie</dd>
                <dt>Phone</dt><dd><a href={`tel:${DISPATCH_PHONE.tel}`}>+233 (0)24 351 8749</a><br /><a href={`tel:${OFFICE_PHONE.tel}`}>+233 (0)24 927 6713</a></dd>
                <dt>Hours</dt><dd>Mon–Sat, 06:00–18:00 GMT. Dispatch line answers Sundays for machines already on hire.</dd>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <Partners />

      <QuoteBand machines={machines} rates={rates} wa={wa} />

      <section className="band" id="faq">
        <div className="wrap">
          <div className="head"><div><p className="eyebrow">Questions</p><h2 style={{ marginTop: ".5rem" }}>Good to know</h2></div></div>
          <div className="faq">
            {faq.map((f) => <details className="q" key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div>
      </section>
      <Footer />
      <StickyBar wa={wa} />
      <MachineDialog machines={cards} rates={rates} wa={wa} />
      <JsonLd data={[businessJsonLd(machines), faqJsonLd(faq)]} />
    </>
  );
}
