import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

// The fleet lives in src/data/catalogue.json: one list for the seed, the public tiles and the admin Catalogue sync page.
const machines = require("../src/data/catalogue.json");

for (const [i, m] of machines.entries()) {
  const data = { ...m, specs: JSON.stringify(m.specs), rateUnit: m.rateUnit ?? "day", sortOrder: i, priceOnRequest: m.priceOnRequest ?? false };
  await prisma.machine.upsert({ where: { slug: m.slug }, update: data, create: data });
}
console.log(`Seeded ${machines.length} machines`);

// Estimator inputs per machine: assumed diesel burn per 8-hour day, and units that drive themselves to site
// (no low bed line). A catalogue entry may carry its own fuelLPerDay / selfDrive; these are the defaults by slug.
const FUEL_L_PER_DAY = { "mini-excavator": 30, backhoe: 50, loadall: 40, "roller-10t": 50, "excavator-20t": 120, "excavator-30t": 180, "bulldozer-d6": 160, "wheel-loader": 110, "motor-grader": 100, "mobile-crane": 80, "pile-driver": 150 };
const SELF_DRIVE = ["lowbed", "tipper", "water-tanker"];
// catalogue.json now carries fuelLPerDay and selfDrive; this only fills blanks left by older rows.
for (const [slug, fuelLPerDay] of Object.entries(FUEL_L_PER_DAY)) await prisma.machine.updateMany({ where: { slug, fuelLPerDay: null }, data: { fuelLPerDay } });
await prisma.machine.updateMany({ where: { slug: { in: SELF_DRIVE } }, data: { selfDrive: true } });

// Low bed transport zones, upserted by name. Prices in default-zones.json are placeholders the owner edits under Pricing.
const defaultZones = require("./default-zones.json");
for (const z of defaultZones.zones) {
  const data = { label: z.label, towns: z.towns, maxKm: z.maxKm, lowBedEachWay: z.lowBedEachWay, sortOrder: z.sortOrder };
  await prisma.zone.upsert({ where: { name: z.name }, update: data, create: { name: z.name, ...data } });
}
console.log(`Seeded ${defaultZones.zones.length} transport zones${defaultZones.assumed ? " (placeholder prices, owner to edit)" : ""}`);

// Staff accounts. Passwords come from .env; existing accounts keep their password.
const staff = [
  { username: "ceo", name: "Narh Richard Mashie", role: "superadmin", password: process.env.SUPERADMIN_PASSWORD },
  { username: "frontdesk", name: "Front desk", role: "admin", password: process.env.ADMIN_PASSWORD },
];
for (const s of staff) {
  if (!s.password) { console.log(`Skipping ${s.username}: no password in .env`); continue; }
  const exists = await prisma.staff.findUnique({ where: { username: s.username } });
  if (exists) continue;
  await prisma.staff.create({ data: { username: s.username, name: s.name, role: s.role, passwordHash: hashPassword(s.password) } });
  console.log(`Created ${s.role} account "${s.username}"`);
}
await prisma.$disconnect();
