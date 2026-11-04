import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StickyBar } from "@/components/StickyBar";
import { PublicChat } from "@/components/PublicChat";
import { PageHero } from "@/components/PageHero";
import { MachineDetail } from "@/components/MachineDetail";
import { groupOf } from "@/data/catalogue";
import { REGIONS } from "@/data/regions";
import { ghs, parseSpecs } from "@/lib/format";
import { loadPublic, priceShown } from "@/lib/public-data";
import { abs, breadcrumbJsonLd, BUSINESS_ID, hireTitle, JsonLd, og } from "@/lib/seo";
import { BUSINESS_NAME, DISPATCH_PHONE } from "@/lib/contact";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const blurb = (m: { name: string; specs: string }) => {
  const specs = parseSpecs(m.specs).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(", ");
  return `Hire a ${m.name} from RINAMAS in Accra${specs ? `: ${specs}` : ""}. With or without our operator, by the day, week or month, delivered to sites across Ghana.`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { machines, pricing } = await loadPublic();
  const m = machines.find((x) => x.slug === slug);
  if (!m) return { title: "Machine not found" };
  const price = priceShown(pricing.showPrices, m) ? ` From ${ghs(m.dayRate)} per ${m.rateUnit === "trip" ? "trip" : "day"}.` : "";
  return {
    title: `${hireTitle(m.name)} · Accra & across Ghana`,
    description: blurb(m) + price,
    alternates: { canonical: `/hire/${m.slug}` },
    openGraph: og({ title: `${hireTitle(m.name)} · RINAMAS`, description: blurb(m), url: `/hire/${m.slug}` }),
  };
}

export default async function MachinePage({ params }: Props) {
  const { slug } = await params;
  const { machines, pricing, cards, rates, wa } = await loadPublic();
  const m = machines.find((x) => x.slug === slug);
  const card = cards.find((x) => x.slug === slug);
  if (!m || !card) notFound();

  const sizes = groupOf(m.slug).map((s) => machines.find((x) => x.slug === s)).filter((x) => x && x.slug !== m.slug);
  const others = machines.filter((x) => x.slug !== m.slug && !sizes.includes(x));
  const shown = priceShown(pricing.showPrices, m);

  const service = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: hireTitle(m.name),
    serviceType: "Heavy equipment rental",
    category: m.categoryLabel,
    description: blurb(m),
    image: abs(m.image),
    url: abs(`/hire/${m.slug}`),
    areaServed: { "@type": "Country", name: "Ghana" },
    provider: { "@type": "LocalBusiness", "@id": BUSINESS_ID, name: BUSINESS_NAME, telephone: DISPATCH_PHONE.tel, url: abs("/") },
    additionalProperty: parseSpecs(m.specs).map(([name, value]) => ({ "@type": "PropertyValue", name, value })),
    ...(shown ? {
      offers: {
        "@type": "Offer",
        url: abs(`/hire/${m.slug}`),
        priceCurrency: "GHS",
        price: m.dayRate,
        priceSpecification: { "@type": "UnitPriceSpecification", price: m.dayRate, priceCurrency: "GHS", unitText: m.rateUnit === "trip" ? "trip" : "day", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: m.rateUnit === "trip" ? "trip" : "day" } },
        availability: m.available ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
        seller: { "@id": BUSINESS_ID },
      },
    } : {}),
  };

  return (
    <>
      <Header />
      <PageHero
        crumbs={[["Home", "/"], ["Machines", "/hire"], [m.name, `/hire/${m.slug}`]]}
        eyebrow={m.categoryLabel}
        title={hireTitle(m.name)}
        sub="With or without our operator, by the day, week or month. Delivered from our N1 yard in Accra to sites across Ghana."
      />
      <section className="band machine-page">
        <div className="wrap">
          {sizes.length > 0 && (
            <nav className="size-links" aria-label="Other sizes">
              <span>Other sizes</span>
              {sizes.map((s) => <a key={s!.slug} className="chip" href={`/hire/${s!.slug}`}>{s!.name}</a>)}
            </nav>
          )}
          <MachineDetail m={card} rates={rates} wa={wa} idPrefix="" formId="quote" priority />
        </div>
      </section>

      <section className="band band-surface">
        <div className="wrap link-cols">
          <div>
            <p className="eyebrow">Delivered nationwide</p>
            <h2 style={{ marginTop: ".5rem" }}>Where we send it</h2>
            <ul className="link-list">
              {REGIONS.map((r) => <li key={r.slug}><a href={`/regions/${r.slug}`}>{r.name}</a><span>{r.towns.slice(0, 3).join(", ")} · {r.delivery}</span></li>)}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Also on the yard</p>
            <h2 style={{ marginTop: ".5rem" }}>Other machines</h2>
            <ul className="link-list">
              {others.map((o) => <li key={o.slug}><a href={`/hire/${o.slug}`}>{hireTitle(o.name)}</a><span>{o.categoryLabel}</span></li>)}
            </ul>
          </div>
        </div>
      </section>
      <Footer />
      <StickyBar wa={wa} />
      <PublicChat machines={machines} wa={wa} />
      <JsonLd data={[service, breadcrumbJsonLd([["Home", "/"], ["Machines", "/hire"], [m.name, `/hire/${m.slug}`]])]} />
    </>
  );
}
