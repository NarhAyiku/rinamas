// Structured data and URLs for search engines and AI assistants (Google, Meta AI, ChatGPT, Gemini).
// The business details come from contact.ts so the site, the JSON-LD and the public profiles never disagree.
import { ADDRESS, BUSINESS_NAME, CEO, DISPATCH_PHONE, HOURS, MAPS_URL, OFFICE_PHONE, SOCIAL, YARD_GEO } from "./contact";
import { REGIONS } from "@/data/regions";
import type { Faq } from "@/data/faq";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rinamas.com").replace(/\/$/, "");
export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
export const BUSINESS_ID = `${SITE_URL}/#business`;

/** Machine-hire title for headings and page titles: "Backhoe loader" → "Backhoe loader hire",
 *  "Bulldozer, D6 class" → "Bulldozer hire, D6 class", so the search phrase stays together. */
export const hireTitle = (name: string) => {
  const i = name.indexOf(", ");
  return i < 0 ? `${name} hire` : `${name.slice(0, i)} hire${name.slice(i)}`;
};

type Json = Record<string, unknown>;

/** The share card (1200×630, Loadall photo, badge, name). A static JPEG under 300 KB, because WhatsApp drops larger
 *  link-preview images, and WhatsApp is where most RINAMAS links get shared. */
export const OG_IMAGE = { url: "/og-card.jpg", width: 1200, height: 630, alt: "RINAMAS Equipment and Trading Enterprise: heavy machine hire across Ghana" };

/** A page's full Open Graph block. Next replaces (never merges) a parent's openGraph, so every page passes all of it. */
export const og = ({ title, description, url }: { title: string; description: string; url: string }) =>
  ({ type: "website" as const, locale: "en_GH", siteName: "RINAMAS Equipment & Trading", title, description, url, images: [OG_IMAGE] });

export function businessJsonLd(machines: { name: string; slug: string }[] = []): Json {
  const sameAs = Object.values(SOCIAL).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": BUSINESS_ID,
    name: BUSINESS_NAME,
    alternateName: "RINAMAS",
    description: "Heavy-machine hire, haulage and operators across Ghana: excavators, backhoes, dozers, loaders, graders, rollers, tipper trucks, low beds, cranes and telehandlers, from a yard on the Accra-Tema Motorway in Accra.",
    url: SITE_URL,
    logo: abs("/icon-512.png"),
    image: abs(OG_IMAGE.url),
    telephone: DISPATCH_PHONE.tel,
    contactPoint: [
      { "@type": "ContactPoint", telephone: DISPATCH_PHONE.tel, contactType: "dispatch", areaServed: "GH", availableLanguage: ["en"] },
      { "@type": "ContactPoint", telephone: OFFICE_PHONE.tel, contactType: "customer service", areaServed: "GH", availableLanguage: ["en"] },
    ],
    address: { "@type": "PostalAddress", streetAddress: ADDRESS.street, addressLocality: ADDRESS.locality, addressRegion: ADDRESS.region, addressCountry: ADDRESS.country },
    ...(YARD_GEO ? { geo: { "@type": "GeoCoordinates", latitude: YARD_GEO.lat, longitude: YARD_GEO.lng } } : {}),
    hasMap: MAPS_URL,
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: HOURS.days, opens: HOURS.opens, closes: HOURS.closes }],
    areaServed: [{ "@type": "Country", name: "Ghana" }, ...REGIONS.map((r) => ({ "@type": "AdministrativeArea", name: `${r.name} Region, Ghana` }))],
    founder: { "@type": "Person", name: CEO, jobTitle: "CEO" },
    paymentAccepted: "MTN Mobile Money, bank transfer, cheque",
    currenciesAccepted: "GHS",
    ...(sameAs.length ? { sameAs } : {}),
    ...(machines.length ? {
      makesOffer: machines.map((m) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: hireTitle(m.name), url: abs(`/hire/${m.slug}`) } })),
    } : {}),
  };
}

export const faqJsonLd = (items: Faq[]): Json => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

export const breadcrumbJsonLd = (trail: [string, string][]): Json => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
});

/** One JSON-LD block. `<` is escaped so text can never close the script tag. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
