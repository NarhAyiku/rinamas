import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StickyBar } from "@/components/StickyBar";
import { PageHero } from "@/components/PageHero";
import { Fleet } from "@/components/Fleet";
import { MachineDialog } from "@/components/MachineDialog";
import { QuoteBand } from "@/components/QuoteBand";
import { REGIONS, regionBySlug, regionLabel } from "@/data/regions";
import { ghs } from "@/lib/format";
import { loadPublic } from "@/lib/public-data";
import { breadcrumbJsonLd, businessJsonLd, JsonLd, og } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = regionBySlug(slug);
  if (!r) return { title: "Region not found" };
  const towns = r.towns.slice(0, 3).join(", ");
  const title = `Heavy equipment hire in ${regionLabel(r)}: ${towns}`;
  const description = `Excavators, backhoes, dozers, graders, rollers, tippers and low beds for hire in ${towns} and across ${regionLabel(r)}, from RINAMAS's N1 yard in Accra. Delivery ${r.delivery}, with or without operator.`;
  return { title, description, alternates: { canonical: `/regions/${r.slug}` }, openGraph: og({ title, description, url: `/regions/${r.slug}` }) };
}

export default async function RegionPage({ params }: Props) {
  const { slug } = await params;
  const r = regionBySlug(slug);
  if (!r) notFound();
  const { machines, pricing, zones, cards, rates, wa } = await loadPublic();

  // Popular machines for this region first, then the rest in yard order.
  const rank = (s: string) => { const i = r.popular.indexOf(s); return i < 0 ? 99 : i; };
  const ordered = [...cards].sort((a, b) => rank(a.slug) - rank(b.slug));
  // Transport zones that reach this region's towns, matched by name.
  const near = zones.filter((z) => r.towns.some((t) => z.towns.toLowerCase().includes(t.toLowerCase())));
  const lastZone = zones[zones.length - 1];
  const crumbs: [string, string][] = [["Home", "/"], ["Coverage", "/#coverage"], [r.name, `/regions/${r.slug}`]];

  return (
    <>
      <Header />
      <PageHero
        crumbs={crumbs}
        eyebrow="Coverage"
        title={`Machine hire in ${regionLabel(r)}`}
        sub={<>{r.towns.join(" · ")}. From our N1 yard in Accra, {r.delivery}.</>}
      />
      <section className="band">
        <div className="wrap region-page">
          <div>
            <p className="lede">{r.intro}</p>
          </div>
          <dl className="region-facts">
            <div><dt>Delivery</dt><dd>{r.delivery.charAt(0).toUpperCase() + r.delivery.slice(1)}, from booking to machine on site</dd></div>
            <div><dt>Leaves from</dt><dd>Our yard off the N1 Highway, George Walker Bush Motorway, Accra</dd></div>
            <div><dt>Transport</dt><dd>
              {near.length > 0
                ? <>{near.map((z) => `Zone ${z.name} (${z.towns})${pricing.showPrices ? `: ${ghs(z.lowBedEachWay)} each way` : ""}`).join("; ")}. Other towns are quoted by distance.</>
                : <>Low bed quoted by road distance from Accra{pricing.showPrices ? `, at ${ghs(pricing.perKmBeyond)} per km beyond ${lastZone?.maxKm ?? 120} km` : ""}, shown as its own line on your quote.</>}
            </dd></div>
            <div><dt>Operators</dt><dd>Ours, or bring your own with a valid Ghanaian heavy-duty licence</dd></div>
          </dl>
        </div>
      </section>

      <section className="band band-surface" id="fleet">
        <div className="wrap">
          <div className="head"><div>
            <p className="eyebrow">For {r.name} sites</p>
            <h2 style={{ marginTop: ".5rem" }}>Machines we send to {r.name}</h2>
            <p className="lede">The machines most asked for in {r.name} come first. Tap any of them for specs, {pricing.showPrices ? "rates" : "today's rate"} and a quick request.</p>
          </div></div>
          <Fleet machines={ordered} showPrices={pricing.showPrices} />
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <p className="eyebrow">Elsewhere in Ghana</p>
          <ul className="link-list link-list-row" style={{ marginTop: "1rem" }}>
            {REGIONS.filter((o) => o.slug !== r.slug).map((o) => <li key={o.slug}><a href={`/regions/${o.slug}`}>{o.name}</a><span>{o.towns.slice(0, 3).join(", ")}</span></li>)}
          </ul>
        </div>
      </section>

      <QuoteBand machines={machines} rates={rates} wa={wa} title={`Get a quote for your ${r.name} site`} />
      <Footer />
      <StickyBar wa={wa} />
      <MachineDialog machines={cards} rates={rates} wa={wa} />
      <JsonLd data={[businessJsonLd(machines), breadcrumbJsonLd(crumbs.filter(([, p]) => !p.includes("#")))]} />
    </>
  );
}
