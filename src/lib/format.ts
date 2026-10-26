export const ghs = (n: number) => `GH₵ ${n.toLocaleString("en-GH")}`;

export const CATEGORIES: Record<string, string> = {
  earth: "Earthmoving",
  haul: "Haulage",
  road: "Road & compaction",
  lift: "Lifting",
};

export const STATUSES = ["new", "quoted", "confirmed", "closed"] as const;
export type Status = (typeof STATUSES)[number];

export function makeReference() {
  const d = new Date();
  const ymd = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RQ-${ymd}-${rand}`;
}

export function waLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function parseSpecs(json: string): [string, string][] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
