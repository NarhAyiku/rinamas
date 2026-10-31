export const ghs = (n: number) => `GH₵ ${n.toLocaleString("en-GH")}`;

export const CATEGORIES: Record<string, string> = {
  earth: "Earthmoving",
  haul: "Haulage",
  road: "Road & compaction",
  lift: "Lifting",
};

// Hire lifecycle. Order matters: it is the progress shown to the customer.
export const STATUSES = ["new", "quoted", "confirmed", "on_hire", "closed"] as const;
export const ALL_STATUSES = [...STATUSES, "lost"] as const;
export type Status = (typeof ALL_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  new: "New", quoted: "Quoted", confirmed: "Confirmed", on_hire: "On hire", closed: "Closed", lost: "Lost",
};
export const STATUS_HINT: Record<string, string> = {
  new: "Request received, quote being prepared",
  quoted: "Written quote sent, ready to accept",
  confirmed: "Booking confirmed, machine and date held",
  on_hire: "Machine delivered and working on site",
  closed: "Machine back at the yard, all settled",
  lost: "Closed without a hire",
};

export function makeReference() {
  const d = new Date();
  const ymd = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RQ-${ymd}-${rand}`;
}

export function waLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Ghana local number (024 351 8749) -> international digits (233243518749). */
export function intl(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("233")) return d;
  if (d.startsWith("0")) return "233" + d.slice(1);
  return d;
}

export function parseSpecs(json: string): [string, string][] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const fmtDate = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Africa/Accra", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
