/**
 * RINAMAS pricing engine. Pure TypeScript with no imports so the same code runs in the
 * browser (live estimate on the quote form, staff calculator) and on the server
 * (the API recomputes every estimate before it is stored; nothing from the client is trusted).
 *
 * A job is three lines: Hire (day rate × days, cheapest of day / week / month applied
 * automatically), Transport (low bed there and back, by zone or per km from the yard) and
 * Extras (operator, diesel). Everything is GH₵ integers rounded to the nearest 10.
 */

export type Rules = {
  dayHours: number;        // metered hours in one hire day
  minDays: number;         // minimum hire, days
  weekDays: number;        // days charged for a week
  weekDiscountPct: number; // off the day rate × weekDays
  monthDays: number;       // days charged for a month
  monthDiscountPct: number;
  dieselPrice: number | null; // GH₵ per litre, null = diesel billed on metered litres
  perKmBeyond: number;     // GH₵ per loaded km beyond the last zone
  vatPct: number;          // 0 = VAT off
  vatIncluded: boolean;    // rates already include VAT (no VAT line)
  standbyPct: number;      // standby day as % of the day rate
  depositPct: number;      // deposit as % of the total
};

export const DEFAULT_RULES: Rules = {
  dayHours: 8, minDays: 1, weekDays: 6, weekDiscountPct: 10, monthDays: 26, monthDiscountPct: 20,
  dieselPrice: null, perKmBeyond: 18, vatPct: 0, vatIncluded: false, standbyPct: 50, depositPct: 50,
};

export type RateMachine = {
  id: string; name: string; dayRate: number; rateUnit: string; // "day" | "trip"
  operatorRate: number | null; fuelLPerDay: number | null; selfDrive: boolean; priceOnRequest: boolean;
};

export type RateZone = { id: string; name: string; label: string; towns: string; maxKm: number; lowBedEachWay: number };

/** Serialisable table the public page passes to the quote form. Rates are stripped when showPrices is false. */
export type RateTable = {
  machines: RateMachine[];
  zones: RateZone[];
  rules: Rules;
  reviewedAt: string | null;
  usdRate: string | null;
  showPrices: boolean;
};

export type EstimateInput = {
  machine: RateMachine;
  days: number;
  zone?: RateZone | null;
  km?: number | null;      // one-way road distance when no zone fits (staff calculator)
  trips?: number | null;   // for per-trip machines (low bed), default 1
  operator: boolean;
  fuel: boolean;
  rules: Rules;
};

export type EstimateLine = { key: "hire" | "transport" | "operator" | "fuel"; label: string; detail: string; amount: number };

export type EstimateOk = {
  ok: true;
  lines: EstimateLine[];
  subtotal: number;
  vat: number;
  total: number;
  deposit: number;
  basis: string;   // how the hire line was priced, e.g. "2 weeks + 1 day"
  days: number;
  notes: string[];
};
export type Estimate = EstimateOk | { ok: false; reason: string };

export const round10 = (n: number) => Math.round(n / 10) * 10;

export const fmtGhs = (n: number) => `GH₵ ${Math.round(n).toLocaleString("en-GH")}`;

/** Day, week and month prices for one machine. Week and month are discounted bundles of days. */
export function ladder(dayRate: number, rules: Rules = DEFAULT_RULES) {
  return {
    day: round10(dayRate),
    week: round10(dayRate * rules.weekDays * (1 - rules.weekDiscountPct / 100)),
    month: round10(dayRate * rules.monthDays * (1 - rules.monthDiscountPct / 100)),
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Cheapest way to cover `days` with any combination of day, week and month bundles
 * (a bundle may cover more days than needed: 5 days can be a week if the week is cheaper).
 */
export function hireCost(dayRate: number, days: number, rules: Rules = DEFAULT_RULES): { amount: number; basis: string; months: number; weeks: number; days: number } {
  const l = ladder(dayRate, rules);
  const n = Math.max(1, Math.min(3650, Math.ceil(days)));
  const weekLen = Math.max(1, Math.floor(rules.weekDays)), monthLen = Math.max(weekLen, Math.floor(rules.monthDays));
  const best: { cost: number; m: number; w: number; d: number }[] = [{ cost: 0, m: 0, w: 0, d: 0 }];
  for (let i = 1; i <= n; i++) {
    const byDay = best[i - 1], byWeek = best[Math.max(0, i - weekLen)], byMonth = best[Math.max(0, i - monthLen)];
    let pick = { cost: byDay.cost + l.day, m: byDay.m, w: byDay.w, d: byDay.d + 1 };
    if (byWeek.cost + l.week < pick.cost) pick = { cost: byWeek.cost + l.week, m: byWeek.m, w: byWeek.w + 1, d: byWeek.d };
    if (byMonth.cost + l.month < pick.cost) pick = { cost: byMonth.cost + l.month, m: byMonth.m + 1, w: byMonth.w, d: byMonth.d };
    best[i] = pick;
  }
  const b = best[n];
  const parts: string[] = [];
  if (b.m) parts.push(plural(b.m, "month"));
  if (b.w) parts.push(plural(b.w, "week"));
  if (b.d) parts.push(plural(b.d, "day"));
  const basis = parts.length === 1 && b.d ? `${plural(b.d, "day")} at the day rate` : parts.join(" + ");
  return { amount: b.cost, basis, months: b.m, weeks: b.w, days: b.d };
}

/** Itemised indicative estimate for one job, or the reason none can be given. */
export function estimate(input: EstimateInput): Estimate {
  const { machine, rules } = input;
  if (machine.priceOnRequest) return { ok: false, reason: "Quoted per job after a site call" };
  if (!(machine.dayRate > 0)) return { ok: false, reason: "Call dispatch for today's rate" };
  const days = Math.max(Math.max(1, rules.minDays), Math.floor(Number(input.days) || 0));
  if (!(days >= 1)) return { ok: false, reason: "Enter how many days you need the machine" };
  const lines: EstimateLine[] = [];
  const notes: string[] = [];
  let basis = "";
  const perTrip = machine.rateUnit === "trip";

  if (perTrip) {
    const trips = Math.max(1, Math.floor(Number(input.trips) || 1));
    basis = `${plural(trips, "loaded trip")}`;
    lines.push({ key: "hire", label: machine.name, detail: `${plural(trips, "trip")} × ${fmtGhs(machine.dayRate)} per loaded trip`, amount: round10(machine.dayRate * trips) });
    if (input.zone) notes.push(`Trip price covers ${input.zone.label.toLowerCase()} (Zone ${input.zone.name}); longer runs are quoted per km.`);
    else notes.push("Trip price is set per route once you tell us the site.");
  } else {
    const h = hireCost(machine.dayRate, days, rules);
    basis = h.basis;
    lines.push({ key: "hire", label: `Hire, ${machine.name}`, detail: `${h.basis} (${fmtGhs(machine.dayRate)} per ${rules.dayHours}-hour day)`, amount: h.amount });

    if (!machine.selfDrive) {
      if (input.zone) {
        lines.push({ key: "transport", label: "Low bed, to site and back", detail: `Zone ${input.zone.name}, ${input.zone.label.toLowerCase()}: 2 × ${fmtGhs(input.zone.lowBedEachWay)}`, amount: round10(input.zone.lowBedEachWay * 2) });
      } else if (input.km && input.km > 0 && rules.perKmBeyond > 0) {
        const km = Math.ceil(input.km);
        lines.push({ key: "transport", label: "Low bed, to site and back", detail: `about ${km} km each way at ${fmtGhs(rules.perKmBeyond)} per loaded km, 2 legs`, amount: round10(km * rules.perKmBeyond * 2) });
        notes.push("Per-km low bed cost is confirmed by dispatch against the actual route.");
      } else {
        notes.push("Low bed to site and back is quoted once we know the site.");
      }
    } else {
      notes.push(`${machine.name} drives to site; no low bed needed.`);
    }

    if (input.operator) {
      if (machine.operatorRate != null && machine.operatorRate > 0) {
        lines.push({ key: "operator", label: "Operator", detail: `${plural(days, "day")} × ${fmtGhs(machine.operatorRate)}`, amount: round10(machine.operatorRate * days) });
      } else {
        notes.push("Operator is included in the rate.");
      }
    }
  }

  if (input.fuel) {
    if (!perTrip && machine.fuelLPerDay && rules.dieselPrice) {
      lines.push({ key: "fuel", label: "Diesel, delivered to site", detail: `about ${machine.fuelLPerDay} L/day × ${plural(days, "day")} at ${fmtGhs(rules.dieselPrice)}/L`, amount: round10(machine.fuelLPerDay * rules.dieselPrice * days) });
      notes.push("Diesel is billed on the litres actually used; this figure is an allowance.");
    } else if (!perTrip) {
      notes.push("Diesel comes on top, on metered litres at pump price, for what the machine actually uses.");
    }
  } else if (!perTrip) {
    notes.push("You fuel it yourself: it arrives with a full tank and goes back full.");
  }

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const vat = rules.vatPct > 0 && !rules.vatIncluded ? round10(subtotal * rules.vatPct / 100) : 0;
  const total = subtotal + vat;
  const deposit = round10(total * rules.depositPct / 100);
  if (rules.vatPct > 0 && rules.vatIncluded) notes.push(`Prices include VAT at ${rules.vatPct}%.`);
  if (rules.vatPct === 0) notes.push("No VAT is added: RINAMAS is not VAT registered.");
  if (!perTrip) {
    notes.push(`A day is ${rules.dayHours} metered hours; longer days are pro rata, with operator overtime at 1.5×.`);
    notes.push(`Standby days for rain or site delays are charged at ${rules.standbyPct}% of the day rate, not the full rate.`);
  }
  notes.push("Indicative. Dispatch confirms the figure in writing; once you accept, that rate is locked for your whole hire.");
  return { ok: true, lines, subtotal, vat, total, deposit, basis, days, notes };
}

/** Plain text for WhatsApp or the clipboard. */
export function estimateText(est: Estimate, ctx: { machineName: string; days: number; zone?: RateZone | null; km?: number | null; reference?: string | null; reviewedAt?: string | null; usdRate?: string | null }): string {
  const head = `RINAMAS indicative estimate${ctx.reference ? ` for ${ctx.reference}` : ""}`;
  if (!est.ok) return `${head}\n${ctx.machineName}: ${est.reason}.`;
  const where = ctx.zone ? `Zone ${ctx.zone.name} (${ctx.zone.towns})` : ctx.km ? `about ${Math.ceil(ctx.km)} km from the yard` : "site to be confirmed";
  const out = [head, `${ctx.machineName} · ${plural(est.days, "day")} · ${where}`];
  for (const l of est.lines) out.push(`${l.label} (${l.detail}): ${fmtGhs(l.amount)}`);
  if (est.vat > 0) out.push(`VAT: ${fmtGhs(est.vat)}`);
  out.push(`TOTAL ${fmtGhs(est.total)} indicative · deposit ${fmtGhs(est.deposit)} to hold your date`);
  if (ctx.reviewedAt) out.push(`Rates reviewed ${ctx.reviewedAt}${ctx.usdRate ? ` at GH₵ ${ctx.usdRate} to the dollar` : ""}.`);
  for (const n of est.notes) out.push(`- ${n}`);
  return out.join("\n");
}

/** Days implied by the old free-text durations ("2–5 days", "1 week", "Longer than a month"). Upper end of a range. */
export function daysFromDuration(s: string | null | undefined, rules: Rules = DEFAULT_RULES): number | null {
  if (!s) return null;
  const t = s.toLowerCase();
  const nums = t.match(/\d+/g)?.map(Number) ?? [];
  const n = nums.length ? nums[nums.length - 1] : 1;
  if (/longer|more than/.test(t) && /month/.test(t)) return rules.monthDays * 2;
  if (/month/.test(t)) return n * rules.monthDays;
  if (/week/.test(t)) return n * rules.weekDays;
  if (/day/.test(t)) return n;
  return nums.length ? n : null;
}

/** Human label for the duration stored on a request. */
export const durationLabel = (days: number) => plural(days, "day");
