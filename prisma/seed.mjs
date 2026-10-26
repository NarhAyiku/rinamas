import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const machines = [
  { slug: "lowbed", name: "Low bed trailer, 60T", category: "haul", categoryLabel: "Haulage · Mobilisation", image: "/img/lowbed.jpg", dayRate: 2800, rateUnit: "trip", operatorRate: null,
    specs: [["Payload", "60 T"], ["Deck", "3-axle · 3.0 m wide"], ["Tractor", "6×4 prime mover"], ["Best for", "Moving excavators, dozers"]] },
  { slug: "excavator-20t", name: "Excavator, 20T class", category: "earth", categoryLabel: "Earthmoving · Trenching", image: "/img/exc20.jpg", dayRate: 8500, operatorRate: 500,
    specs: [["Operating weight", "20–22 T"], ["Bucket", "0.9–1.0 m³"], ["Dig depth", "6.7 m"], ["Best for", "Foundations, drains, bulk dig"]] },
  { slug: "excavator-30t", name: "Heavy excavator, 30T+", category: "earth", categoryLabel: "Earthmoving · Mass excavation", image: "/img/exc30.jpg", dayRate: 12000, operatorRate: 600,
    specs: [["Operating weight", "30–36 T"], ["Bucket", "1.4–1.6 m³"], ["Options", "Long reach, breaker"], ["Best for", "Quarry, mass cut, demolition"]] },
  { slug: "mini-excavator", name: "Mini excavator, 3T", category: "earth", categoryLabel: "Earthmoving · Tight access", image: "/img/mini.jpg", dayRate: 4500, operatorRate: 350,
    specs: [["Operating weight", "2.5–3.5 T"], ["Bucket", "0.1 m³"], ["Width", "1.5 m"], ["Best for", "Gutters, septic, house plots"]] },
  { slug: "backhoe", name: "Backhoe loader", category: "earth", categoryLabel: "Earthmoving · Utilities", image: "/img/backhoe.jpg", dayRate: 3500, operatorRate: 350,
    specs: [["Operating weight", "8 T"], ["Rear bucket", "0.3 m³"], ["Front loader", "1.0 m³"], ["Best for", "Trenches, backfill, site tidy"]] },
  { slug: "bulldozer-d6", name: "Bulldozer, D6 class", category: "earth", categoryLabel: "Earthmoving · Clearing", image: "/img/dozer.jpg", dayRate: 9500, operatorRate: 500,
    specs: [["Operating weight", "20–24 T"], ["Blade", "3.9 m · 5.6 m³"], ["Options", "Ripper"], ["Best for", "Bush clearing, cut & fill"]] },
  { slug: "wheel-loader", name: "Wheel loader", category: "lift", categoryLabel: "Loading · Material handling", image: "/img/loader.jpg", dayRate: 7000, operatorRate: 450,
    specs: [["Operating weight", "18–20 T"], ["Bucket", "3.0–3.5 m³"], ["Tip load", "12 T"], ["Best for", "Stockpiles, quarry load-out"]] },
  { slug: "motor-grader", name: "Motor grader", category: "road", categoryLabel: "Road · Finishing grade", image: "/img/grader.jpg", dayRate: 8000, operatorRate: 500,
    specs: [["Operating weight", "14–16 T"], ["Blade", "3.7 m moldboard"], ["Engine", "135 kW"], ["Best for", "Feeder roads, estate roads"]] },
  { slug: "roller-10t", name: "Vibratory roller, 10T", category: "road", categoryLabel: "Road · Compaction", image: "/img/roller.jpg", dayRate: 4000, operatorRate: 350,
    specs: [["Operating weight", "10–12 T"], ["Drum", "2.1 m smooth · padfoot"], ["Centrifugal force", "260 kN"], ["Best for", "Sub-base, laterite fill"]] },
  { slug: "tipper", name: "Tipper truck, 10 m³", category: "haul", categoryLabel: "Haulage · Spoil & aggregate", image: "/img/tipper.jpg", dayRate: 2500, operatorRate: null,
    specs: [["Body", "10 m³ · 15 T"], ["Drive", "6×4"], ["Minimum", "Full day"], ["Best for", "Spoil removal, chippings"]] },
  { slug: "mobile-crane", name: "Mobile crane, 50T", category: "lift", categoryLabel: "Lifting · Steel & precast", image: "/img/crane.jpg", dayRate: 15000, operatorRate: 800,
    specs: [["Capacity", "50 T"], ["Main boom", "40 m"], ["Crew", "Operator + rigger"], ["Best for", "Precast, steel erection"]] },
  { slug: "water-tanker", name: "Water tanker, 10,000 L", category: "haul", categoryLabel: "Haulage · Dust control", image: "/img/tanker.jpg", dayRate: 2200, operatorRate: null,
    specs: [["Capacity", "10,000 L"], ["Spray bar", "Rear, 6 m"], ["Drive", "6×4"], ["Best for", "Compaction water, dust"]] },
];

for (const [i, m] of machines.entries()) {
  const data = { ...m, specs: JSON.stringify(m.specs), rateUnit: m.rateUnit ?? "day", sortOrder: i };
  await prisma.machine.upsert({ where: { slug: m.slug }, update: data, create: data });
}
console.log(`Seeded ${machines.length} machines`);
await prisma.$disconnect();
