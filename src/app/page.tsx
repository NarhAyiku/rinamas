import { prisma } from "@/lib/db";
import { ghs, waLink } from "@/lib/format";
import { DISPATCH_PHONE, MAPS_URL, OFFICE_PHONE, WA_GREETING, whatsappNumber } from "@/lib/contact";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Fleet } from "@/components/Fleet";
import { QuoteForm } from "@/components/QuoteForm";
import { CopyButton } from "@/components/CopyButton";
import { StickyBar } from "@/components/StickyBar";

export const dynamic = "force-dynamic";

const REGIONS: [string, string][] = [
  ["Greater Accra", "Accra, Tema, Kasoa, Oyibi, Prampram"], ["Ashanti", "Kumasi, Obuasi, Ejisu, Konongo"],
  ["Eastern", "Koforidua, Nsawam, Akosombo"], ["Central", "Cape Coast, Winneba, Mankessim"],
  ["Western", "Takoradi, Tarkwa, Bogoso"], ["Volta", "Ho, Sogakope, Aflao"],
  ["Bono & Ahafo", "Sunyani, Techiman, Goaso"], ["Northern & Savannah", "Tamale, Damongo, on request"],
];

export default async function Home() {
  const machines = await prisma.machine.findMany({ orderBy: { sortOrder: "asc" } });
  const wa = whatsappNumber();
  const week = (d: number) => ghs(d * 6 * 0.9);
  const month = (d: number) => ghs(d * 26 * 0.8);

  return (
    <>
      <Header />
      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden="true" />
        <div className="wrap">
          <div>
            <p className="eyebrow" style={{ color: "var(--amber)" }}>JCB Loadalls · Backhoes · Excavators · Dozers · Low beds</p>
            <h1 style={{ marginTop: ".8rem" }}>Heavy iron<br />for Ghana&apos;s<br /><em>working ground.</em></h1>
            <p className="lede">RINAMAS hires out serviced heavy-duty machines, JCB first and Caterpillar where the job calls for it, to contractors, estate developers, quarries and road crews across Ghana. Operator, fuel plan and low-bed haulage can all go on one contract, mobilised from our yard off the N1 Highway in Accra.</p>
            <div className="cta">
              <a className="btn btn-accent" href="#quote">Request a quote</a>
              <a className="btn btn-ghost" href="#fleet">See the fleet &amp; rates</a>
            </div>
          </div>
          <div className="hero-art"><img src="/img/hero-loadall.jpg" alt="JCB 527-58 Loadall telehandler with bucket lowered, ready to work" width={1600} height={931} /></div>
        </div>
      </section>
      <div className="stripe" aria-hidden="true" />
      <section className="stats" aria-label="At a glance">
        <div className="wrap">
          <div className="stat"><b>{machines.length}</b><span>Machine classes on the yard</span></div>
          <div className="stat"><b>N1</b><span>Yard on the George Walker Bush Motorway</span></div>
          <div className="stat"><b>24h</b><span>Dispatch on confirmed deposit</span></div>
          <div className="stat"><b>10</b><span>Regions served</span></div>
        </div>
      </section>

      <section className="band" id="fleet">
        <div className="wrap">
          <div className="head"><div>
            <p className="eyebrow">Spec sheet</p>
            <h2 style={{ marginTop: ".5rem" }}>What&apos;s on the yard</h2>
            <p className="lede">Every class below hires out with or without operator, by the day or by the month. Rates are indicative day rates in Ghana cedis, exclusive of fuel and VAT. Availability shifts weekly, so confirm before you mobilise.</p>
          </div></div>
          <Fleet machines={machines} />
          <p className="note">Rates shown are starting day rates for a standard 8-hour shift, machine only, serviced and insured. Fuel, operator, overtime and low-bed mobilisation are quoted separately. Long-term hire from 4 weeks attracts a discount of 10 to 20 percent. No hire for unlicensed or illegal mining.</p>
        </div>
      </section>

      <section className="band band-surface" id="rates">
        <div className="wrap">
          <div className="head"><div>
            <p className="eyebrow">Rate card</p>
            <h2 style={{ marginTop: ".5rem" }}>Day, week or month</h2>
            <p className="lede">Rates scale down the longer you keep the machine. Figures are indicative in Ghana cedis and confirmed on the quote.</p>
          </div></div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Machine class</th><th>Day (8 h)</th><th>Week (6 days)</th><th>Month (26 days)</th><th>Operator / day</th></tr></thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className="num">{ghs(m.dayRate)}{m.rateUnit === "trip" ? " / trip" : ""}</td>
                    {m.rateUnit === "trip"
                      ? <td className="num" colSpan={2}>Outside Greater Accra: GH₵ 18 per km, loaded</td>
                      : <><td className="num">{week(m.dayRate)}</td><td className="num">{month(m.dayRate)}</td></>}
                    <td className="num">{m.operatorRate ? ghs(m.operatorRate) : "Included"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="incl">
            <div><b>Included in every hire</b><ul><li>Scheduled servicing, logged by hour meter</li><li>Comprehensive insurance and site induction papers</li><li>Standby replacement if a unit goes down for more than 24 hours</li><li>Pre-start checks and PPE for crewed hires</li></ul></div>
            <div><b>Quoted separately</b><ul><li>Diesel, if you hire with fuel; delivered to site and billed on metered hours</li><li>Operator, with overtime after 8 hours at 1.5×</li><li>Low-bed mobilisation to and from site</li><li>Attachments: breaker, ripper, long-reach boom</li></ul></div>
          </div>
        </div>
      </section>

      <section className="band" id="how">
        <div className="wrap">
          <div className="head"><div><p className="eyebrow">How hire works</p><h2 style={{ marginTop: ".5rem" }}>From request to iron on site</h2></div></div>
          <div className="steps">
            <div className="step"><span className="n"><em>01</em> Step 1</span><h3>Send the job</h3><p>Tell us the machine, dates, site location, operator and fuel choice. WhatsApp, a call or the form below all reach dispatch.</p></div>
            <div className="step"><span className="n"><em>02</em> Step 2</span><h3>Confirm &amp; deposit</h3><p>You get a written quote within the working day. A 50 percent deposit by MoMo or bank transfer locks the unit and the date.</p></div>
            <div className="step"><span className="n"><em>03</em> Step 3</span><h3>Mobilise</h3><p>We load the machine on a low bed at the N1 yard. Greater Accra sites usually see it within 24 hours; other regions within 48.</p></div>
            <div className="step"><span className="n"><em>04</em> Step 4</span><h3>Work &amp; settle</h3><p>Hours are logged off the machine&apos;s meter and signed daily by your site agent. Balance is settled against the signed log.</p></div>
          </div>
        </div>
      </section>

      <section className="band band-surface" id="coverage">
        <div className="wrap">
          <div className="head"><div>
            <p className="eyebrow">Coverage</p>
            <h2 style={{ marginTop: ".5rem" }}>One yard, nationwide reach</h2>
            <p className="lede">Every machine mobilises from our yard off the N1 Highway in Accra. Greater Accra trips are a flat rate; beyond that, mobilisation is charged per loaded kilometre.</p>
          </div></div>
          <figure className="photo-band"><img src="/img/ghana.jpg" alt="Excavator on drainage works in Ghana" loading="lazy" width={1600} height={1067} /><figcaption>Excavator on drainage works, Ghana</figcaption></figure>
          <div className="cover">
            <div className="regions">
              {REGIONS.map(([r, towns]) => <div className="region" key={r}><span className="dot" /><div><b>{r}</b><span>{towns}</span></div></div>)}
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

      <section className="band quote" id="quote">
        <div className="wrap">
          <div>
            <p className="eyebrow">Dispatch</p>
            <h2 style={{ marginTop: ".5rem" }}>Get a quote today</h2>
            <p className="lede">Send the form and dispatch gets your request straight away, with a reference number and a one-tap WhatsApp follow-up. Or reach us directly on the numbers here.</p>
            <div className="contact">
              <div className="contact-row"><span className="lbl">WhatsApp</span><a className="code" href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">{DISPATCH_PHONE.display}</a><CopyButton text={DISPATCH_PHONE.tel} /></div>
              <div className="contact-row"><span className="lbl">Call</span><a className="code" href={`tel:${OFFICE_PHONE.tel}`}>{OFFICE_PHONE.display}</a><CopyButton text={OFFICE_PHONE.tel} /></div>
              <div className="contact-row"><span className="lbl">Yard</span><a className="code" href={MAPS_URL} target="_blank" rel="noopener">Off N1 Highway, George Walker Bush Motorway, Accra ↗</a></div>
            </div>
          </div>
          <QuoteForm machines={machines.map((m) => ({ id: m.id, name: m.name }))} />
        </div>
      </section>

      <section className="band" id="faq">
        <div className="wrap">
          <div className="head"><div><p className="eyebrow">Questions</p><h2 style={{ marginTop: ".5rem" }}>Before you mobilise</h2></div></div>
          <div className="faq">
            <details className="q"><summary>Who pays for diesel?</summary><p>Your choice on the quote form. Hire with fuel and RINAMAS delivers diesel to site and bills it against the metered hours. Hire without fuel and the machine leaves the yard with a full tank, you buy diesel on site, and it comes back full or the difference is billed at pump price.</p></details>
            <details className="q"><summary>Do I have to take an operator?</summary><p>No. You can hire machine only if your operator holds a valid Ghanaian heavy-duty licence and signs our pre-start checklist. Operator hire is recommended for excavators above 20T and cranes.</p></details>
            <details className="q"><summary>How much deposit, and how do I pay?</summary><p>50 percent of the quoted hire, by MTN MoMo, bank transfer or cheque for registered companies. The balance is settled against the signed hour log at the end of each week.</p></details>
            <details className="q"><summary>What counts as a day?</summary><p>One shift of 8 metered hours. Hours beyond that are charged pro rata, and operator overtime runs at 1.5× after 8 hours.</p></details>
            <details className="q"><summary>What if the machine breaks down?</summary><p>Minor faults are fixed on site by our mechanic. If a unit is down for more than 24 hours we send a replacement from the yard and the down time is not charged.</p></details>
            <details className="q"><summary>Do you hire for mining?</summary><p>Only for licensed operations with Minerals Commission papers. We do not hire for galamsey or any unlicensed mining, and machines found at such sites are recovered immediately.</p></details>
          </div>
        </div>
      </section>
      <Footer />
      <StickyBar wa={wa} />
    </>
  );
}
