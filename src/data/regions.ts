/**
 * The regions RINAMAS serves from the N1 yard. Read by the landing page coverage block, the /regions pages, the
 * sitemap, llms.txt and the chat assistant, so every place says the same thing. Pure data, safe for client code.
 */
export type Region = {
  slug: string;
  name: string;
  /** Main towns, most asked-for first. */
  towns: string[];
  /** Usual time from booking to machine on site. */
  delivery: string;
  /** One paragraph on the work machines do there. Each region's own words, so the pages are not copies of each other. */
  intro: string;
  /** Machines most asked for in this region, by catalogue slug, shown first on the region page. */
  popular: string[];
};

export const REGIONS: Region[] = [
  {
    slug: "greater-accra",
    name: "Greater Accra",
    towns: ["Accra", "Tema", "Oyibi", "Prampram", "Madina", "Adenta", "Dodowa"],
    delivery: "usually within 24 hours",
    intro: "Our yard sits on the N1 in Accra, so Greater Accra sites are the closest we serve. Estate roads in Oyibi and Prampram, foundations and drains in Tema and Madina, plot clearing around Dodowa: most jobs here need a backhoe, an excavator or a payloader for a few days, and a low bed gets it to you on a set zone price.",
    popular: ["backhoe", "excavator-20t", "wheel-loader", "tipper", "roller-10t"],
  },
  {
    slug: "ashanti",
    name: "Ashanti",
    towns: ["Kumasi", "Obuasi", "Ejisu", "Konongo"],
    delivery: "usually within 48 hours",
    intro: "Kumasi's growth keeps estate, road and drainage work going all year, and Obuasi and Konongo bring heavier earthmoving. For hires in Ashanti we usually send the machine with our operator, since a day lost to a missing driver costs more than the trip from Accra. Low-bed transport from the N1 is quoted by distance before you book.",
    popular: ["excavator-20t", "bulldozer-d6", "motor-grader", "wheel-loader", "lowbed"],
  },
  {
    slug: "eastern",
    name: "Eastern",
    towns: ["Koforidua", "Nsawam", "Akosombo"],
    delivery: "usually within 48 hours",
    intro: "Nsawam and Koforidua are a short run up the N6 from our yard, and Akosombo is within our outer zone, so Eastern Region transport is often a fixed zone price rather than a per-km quote. Hilly sites here call for tracked machines: excavators for cutting and drains, dozers for access roads, rollers to finish.",
    popular: ["excavator-20t", "bulldozer-d6", "roller-10t", "backhoe", "tipper"],
  },
  {
    slug: "central",
    name: "Central",
    towns: ["Cape Coast", "Winneba", "Mankessim", "Kasoa"],
    delivery: "usually within 48 hours",
    intro: "From Kasoa through Winneba to Cape Coast, the coast road brings steady demand for road, school and estate work. Winneba is in a set transport zone from Accra; further west we quote the low bed by distance. Graders and rollers for road jobs, and backhoes for services and drains, are the usual asks.",
    popular: ["motor-grader", "roller-10t", "backhoe", "excavator-20t", "tipper"],
  },
  {
    slug: "western",
    name: "Western",
    towns: ["Takoradi", "Tarkwa", "Bogoso"],
    delivery: "usually within 48 hours",
    intro: "Takoradi's port and industrial sites and the Tarkwa and Bogoso mining belt need heavier iron: 30T-plus excavators, dozers and low beds to move them. We hire to licensed mining operations with Minerals Commission papers only, never to galamsey. Send your licence with the request and we'll plan delivery and an operator for the shift pattern you run.",
    popular: ["excavator-30t", "bulldozer-d6", "lowbed", "wheel-loader", "tipper"],
  },
  {
    slug: "volta",
    name: "Volta",
    towns: ["Ho", "Sogakope", "Aflao"],
    delivery: "usually within 48 hours",
    intro: "Volta jobs run from Ho's town works to roads and drains around Sogakope and the border at Aflao. The low bed crosses at Sogakope or Akosombo depending on your site, and we quote transport by distance from the N1 so you see that cost before you book.",
    popular: ["backhoe", "excavator-20t", "motor-grader", "roller-10t", "tipper"],
  },
  {
    slug: "bono-ahafo",
    name: "Bono & Ahafo",
    towns: ["Sunyani", "Techiman", "Goaso"],
    delivery: "usually within 48 hours",
    intro: "Sunyani, Techiman and Goaso are a long haul from Accra, so hires here are usually a week or longer, which brings the per-day rate down. Farm roads, market works and estate plots are the common jobs. We send an operator with the machine, and the low-bed trip is quoted by distance up front.",
    popular: ["motor-grader", "bulldozer-d6", "excavator-20t", "wheel-loader", "lowbed"],
  },
  {
    slug: "northern-savannah",
    name: "Northern & Savannah",
    towns: ["Tamale", "Damongo"],
    delivery: "planned with you, on request",
    intro: "Tamale, Damongo and sites further north are our longest trips, so we plan them with you: dates, a long enough hire to justify the haul, operator lodging and fuel. Road and farm-track work with graders and dozers is the usual job. Call dispatch first and we'll come back with a full quote, transport included.",
    popular: ["motor-grader", "bulldozer-d6", "roller-10t", "excavator-20t", "lowbed"],
  },
];

export const regionBySlug = (slug: string) => REGIONS.find((r) => r.slug === slug);

/** "Ashanti Region", "Bono & Ahafo Regions". */
export const regionLabel = (r: Region) => `${r.name} Region${r.name.includes("&") ? "s" : ""}`;
