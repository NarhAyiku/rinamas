import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StickyBar } from "@/components/StickyBar";
import { PublicChat } from "@/components/PublicChat";
import { PageHero } from "@/components/PageHero";
import { Fleet } from "@/components/Fleet";
import { MachineDialog } from "@/components/MachineDialog";
import { QuoteBand } from "@/components/QuoteBand";
import { REGIONS } from "@/data/regions";
import { loadPublic } from "@/lib/public-data";
import { abs, breadcrumbJsonLd, hireTitle, JsonLd, og } from "@/lib/seo";

export const dynamic = "force-dynamic";

const title = "Machines for hire in Ghana: excavators, backhoes, dozers, low beds";
const description = "Every machine RINAMAS hires from its N1 yard in Accra: excavators, backhoe loaders, bulldozers, wheel loaders, graders, rollers, tipper trucks, low beds, cranes and telehandlers, with or without operator.";

export const metadata: Metadata = { title, description, alternates: { canonical: "/hire" }, openGraph: og({ title, description, url: "/hire" }) };

export default async function HireIndex() {
  const { machines, pricing, cards, rates, wa } = await loadPublic();
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Machines for hire",
    itemListElement: machines.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: hireTitle(m.name), url: abs(`/hire/${m.slug}`) })),
  };

  return (
    <>
      <Header />
      <PageHero
        crumbs={[["Home", "/"], ["Machines", "/hire"]]}
        eyebrow="Spec sheet"
        title="Machines for hire"
        sub="Everything on the N1 yard, with or without our operator, by the day, week or month. Tap a machine for specs and a quick request."
      />
      <section className="band" id="fleet">
        <div className="wrap">
          <Fleet machines={cards} showPrices={pricing.showPrices} />
        </div>
      </section>
      <section className="band band-surface">
        <div className="wrap">
          <p className="eyebrow">Delivered nationwide</p>
          <h2 style={{ marginTop: ".5rem" }}>Hire by region</h2>
          <ul className="link-list link-list-row" style={{ marginTop: "1rem" }}>
            {REGIONS.map((r) => <li key={r.slug}><a href={`/regions/${r.slug}`}>{r.name}</a><span>{r.towns.slice(0, 3).join(", ")} · {r.delivery}</span></li>)}
          </ul>
        </div>
      </section>
      <QuoteBand machines={machines} rates={rates} wa={wa} />
      <Footer />
      <StickyBar wa={wa} />
      <PublicChat machines={machines} wa={wa} />
      <MachineDialog machines={cards} rates={rates} wa={wa} />
      <JsonLd data={[list, breadcrumbJsonLd([["Home", "/"], ["Machines", "/hire"]])]} />
    </>
  );
}
