/**
 * The machine catalogue: the fleet RINAMAS hires, in the order it is shown. `catalogue.json` is the single source for
 * the seed and for the super admin's Catalogue sync page; the live database is updated from it, never hand-copied.
 * Pure data and pure functions only, so both server and client code can import this module.
 */
import raw from "./catalogue.json";
import { parseSpecs } from "@/lib/format";

export type CatalogueMachine = {
  slug: string;
  name: string;
  category: "earth" | "haul" | "road" | "lift";
  categoryLabel: string;
  image: string;
  specs: [string, string][];
  dayRate: number;
  rateUnit?: "day" | "trip";
  operatorRate: number | null;
  priceOnRequest?: boolean;
  /** Estimator: assumed diesel burn per 8-hour day (null = unknown). Staff may tune it; the catalogue only fills a blank. */
  fuelLPerDay: number | null;
  /** Estimator: drives itself to site (tipper, low bed), so no low-bed transport line. A fact of the machine, always synced. */
  selfDrive: boolean;
  /** Position in the catalogue, written to Machine.sortOrder. */
  sortOrder: number;
};

export const CATALOGUE: CatalogueMachine[] = (raw as Omit<CatalogueMachine, "sortOrder">[]).map((m, i) => ({ ...m, sortOrder: i }));

/** The landing-page type picker: one photo tile per kind of machine. `slug` is the machine the pop-up opens on;
 *  `slugs` lists every size of that kind, shown as tabs in the pop-up (defaults to just `slug`). */
export type MachineType = { label: string; filter: "earth" | "haul" | "road" | "lift"; slug: string; slugs?: string[]; image: string; objectPosition?: string };
export const MACHINE_TYPES: MachineType[] = [
  { label: "Payloaders", filter: "lift", slug: "wheel-loader", image: "/img/loader-jcb.jpg", objectPosition: "50% 60%" },
  { label: "Loaders", filter: "earth", slug: "backhoe", slugs: ["backhoe", "wheel-loader"], image: "/img/backhoe.jpg", objectPosition: "50% 60%" },
  { label: "Excavators", filter: "earth", slug: "excavator-20t", slugs: ["mini-excavator", "excavator-20t", "excavator-30t"], image: "/img/exc20-jcb.jpg" },
  { label: "Bulldozers", filter: "earth", slug: "bulldozer-d6", image: "/img/dozer.jpg" },
  { label: "Backhoes", filter: "earth", slug: "backhoe", image: "/img/backhoe-jcb.jpg", objectPosition: "50% 65%" },
  { label: "Graders", filter: "road", slug: "motor-grader", image: "/img/grader.jpg" },
  { label: "Rollers", filter: "road", slug: "roller-10t", image: "/img/roller.jpg" },
  { label: "Cranes", filter: "lift", slug: "mobile-crane", image: "/img/crane.jpg", objectPosition: "50% 45%" },
  { label: "Pile drivers", filter: "earth", slug: "pile-driver", image: "/img/pile-driver.jpg", objectPosition: "50% 40%" },
  { label: "Tipper trucks", filter: "haul", slug: "tipper", image: "/img/tipper.jpg" },
  { label: "Low beds", filter: "haul", slug: "lowbed", image: "/img/lowbed-jcb.jpg", objectPosition: "50% 60%" },
  { label: "Telehandlers", filter: "lift", slug: "loadall", image: "/img/loadall.jpg", objectPosition: "50% 60%" },
];

/** Every size of the kind a machine belongs to, for the pop-up tabs: the excavators together, else the machine alone. */
export const groupOf = (slug: string) => MACHINE_TYPES.find((t) => (t.slugs?.length ?? 0) > 1 && t.slugs!.includes(slug))?.slugs ?? [slug];

/* ---------- catalogue sync: comparing a catalogue entry with the database row ---------- */

/** The database fields the catalogue owns. Rates, availability and price-on-request belong to staff and are never synced. */
export type DbMachineLite = { slug: string; name: string; category: string; categoryLabel: string; image: string; specs: string; sortOrder: number; fuelLPerDay: number | null; selfDrive: boolean };

export type CatalogueChange = { field: "name" | "category" | "categoryLabel" | "specs" | "sortOrder" | "image" | "selfDrive" | "fuelLPerDay"; from: string; to: string };

/** Canonical form of a specs JSON string so whitespace and formatting differences do not count as changes. */
export const normaliseSpecs = (json: string) => JSON.stringify(parseSpecs(json).map(([k, v]) => [String(k).trim(), String(v).trim()]));

/** True when staff uploaded their own photo (Blob URL or /photos/...). Those are never overwritten by the catalogue. */
export const hasCustomPhoto = (m: { image: string }) => !m.image.startsWith("/img/");

/** Every catalogue-owned field whose database value differs. The image counts only while the row still uses a stock /img/ photo. */
export function catalogueDiff(c: CatalogueMachine, db: DbMachineLite): CatalogueChange[] {
  const out: CatalogueChange[] = [];
  if (db.name !== c.name) out.push({ field: "name", from: db.name, to: c.name });
  if (db.category !== c.category) out.push({ field: "category", from: db.category, to: c.category });
  if (db.categoryLabel !== c.categoryLabel) out.push({ field: "categoryLabel", from: db.categoryLabel, to: c.categoryLabel });
  const specsTo = JSON.stringify(c.specs);
  if (normaliseSpecs(db.specs) !== specsTo) out.push({ field: "specs", from: db.specs, to: specsTo });
  if (db.sortOrder !== c.sortOrder) out.push({ field: "sortOrder", from: String(db.sortOrder), to: String(c.sortOrder) });
  if (db.image !== c.image && !hasCustomPhoto(db)) out.push({ field: "image", from: db.image, to: c.image });
  if (db.selfDrive !== c.selfDrive) out.push({ field: "selfDrive", from: db.selfDrive ? "drives itself" : "needs low bed", to: c.selfDrive ? "drives itself" : "needs low bed" });
  if (db.fuelLPerDay == null && c.fuelLPerDay != null) out.push({ field: "fuelLPerDay", from: "not set", to: String(c.fuelLPerDay) });
  return out;
}

/** Full row for a machine that is not on the yard yet. Staff-owned fields start from the catalogue values. */
export function catalogueCreateData(c: CatalogueMachine) {
  return {
    slug: c.slug, name: c.name, category: c.category, categoryLabel: c.categoryLabel, image: c.image, specs: JSON.stringify(c.specs),
    dayRate: c.dayRate, rateUnit: c.rateUnit ?? "day", operatorRate: c.operatorRate, priceOnRequest: c.priceOnRequest ?? false, sortOrder: c.sortOrder,
    fuelLPerDay: c.fuelLPerDay, selfDrive: c.selfDrive,
  };
}

/** Only the fields that changed, ready for prisma.machine.update. */
export function catalogueUpdateData(changes: CatalogueChange[]) {
  const data: Partial<DbMachineLite> = {};
  for (const ch of changes) {
    if (ch.field === "sortOrder") data.sortOrder = Number(ch.to);
    else if (ch.field === "fuelLPerDay") data.fuelLPerDay = Number(ch.to);
    else if (ch.field === "selfDrive") data.selfDrive = ch.to === "drives itself";
    else data[ch.field] = ch.to;
  }
  return data;
}

export const CHANGE_LABEL: Record<CatalogueChange["field"], string> = {
  name: "name", category: "category", categoryLabel: "category label", specs: "specs", sortOrder: "sort order", image: "photo",
  selfDrive: "transport", fuelLPerDay: "fuel per day (L)",
};
