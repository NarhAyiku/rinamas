/**
 * Settlement: what a hire actually cost once the machine is back, built from the record
 * (dispatch and return dates, the signed daily hour log, litres supplied) rather than the
 * customer's estimate. Pure, like the pricing engine, so it is tested with node --test.
 *
 * Days on hire are counted from dispatch to return, both days included. A logged day with
 * no hours worked and some standby is a standby day, charged at the standby rate instead
 * of a full day. Hours beyond the hire day are overtime: machine pro rata, operator at 1.5×.
 * Staff can always override the result: it becomes the final bill only when they apply it.
 */
import { hireCost, round10, fmtGhs, type RateMachine, type Rules } from "./pricing.ts";

export type SettleLog = { date: string; hours: number; standby: number; fuelL: number };

export type SettleInput = {
  machine: RateMachine;
  rules: Rules;
  dispatchDate?: string | null;
  returnDate?: string | null;
  logs: SettleLog[];
  fallbackDays?: number | null; // days on the request, used when there are no dates or logs
  operator: boolean;            // wet hire, RINAMAS operator
  fuel: boolean;                // RINAMAS supplied the diesel
  transport?: number | null;    // low bed there and back, as quoted (from the estimate snapshot)
};

export type SettleLine = { key: "hire" | "standby" | "overtime" | "operator" | "op_overtime" | "fuel" | "transport"; label: string; detail: string; amount: number };
export type SettleOk = {
  ok: true;
  lines: SettleLine[];
  subtotal: number;
  vat: number;
  total: number;
  days: { onHire: number; worked: number; standby: number; source: "dates" | "logs" | "request" };
  notes: string[];
};
export type Settlement = SettleOk | { ok: false; reason: string };

const DAY_MS = 864e5;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isDate = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Calendar days from dispatch to return, both included; null when either date is missing or reversed. */
export function daysOnHire(dispatch?: string | null, ret?: string | null): number | null {
  if (!isDate(dispatch) || !isDate(ret)) return null;
  const n = Math.round((Date.parse(ret) - Date.parse(dispatch)) / DAY_MS) + 1;
  return n >= 1 ? n : null;
}

export function settle(input: SettleInput): Settlement {
  const { machine, rules, logs } = input;
  if (machine.rateUnit === "trip") return { ok: false, reason: "Per-trip machines are billed on the trips run: enter the final bill by hand" };
  if (!(machine.dayRate > 0)) return { ok: false, reason: "This machine has no day rate: enter the final bill by hand" };

  const notes: string[] = [];
  const logDays = new Set(logs.map((l) => l.date)).size;
  const fromDates = daysOnHire(input.dispatchDate, input.returnDate);
  let onHire: number, source: SettleOk["days"]["source"];
  if (fromDates) { onHire = fromDates; source = "dates"; }
  else if (logDays) { onHire = logDays; source = "logs"; notes.push("No dispatch and return dates yet: days counted from the hour log."); }
  else if (input.fallbackDays && input.fallbackDays > 0) { onHire = input.fallbackDays; source = "request"; notes.push("No dates or hour log yet: days taken from the request."); }
  else return { ok: false, reason: "Enter the dispatch and return dates, or log the days worked" };
  onHire = Math.max(onHire, Math.max(1, rules.minDays));

  // A day with standby and no work is a standby day; several logs on one date count once.
  const byDate = new Map<string, { hours: number; standby: number }>();
  for (const l of logs) {
    const d = byDate.get(l.date) ?? { hours: 0, standby: 0 };
    d.hours += l.hours; d.standby += l.standby;
    byDate.set(l.date, d);
  }
  const standbyDays = Math.min(onHire, [...byDate.values()].filter((d) => d.hours === 0 && d.standby > 0).length);
  const worked = onHire - standbyDays;
  if (fromDates && logDays > fromDates) notes.push(`The hour log has ${logDays} dates but dispatch to return is ${fromDates} days: check the dates.`);

  const lines: SettleLine[] = [];
  if (worked > 0) {
    const h = hireCost(machine.dayRate, worked, rules);
    lines.push({ key: "hire", label: `Hire, ${machine.name}`, detail: `${h.basis} (${fmtGhs(machine.dayRate)} per ${rules.dayHours}-hour day)`, amount: h.amount });
  }
  if (standbyDays > 0) {
    const perDay = round10(machine.dayRate * rules.standbyPct / 100);
    lines.push({ key: "standby", label: "Standby", detail: `${plural(standbyDays, "day")} × ${fmtGhs(perDay)} (${rules.standbyPct}% of the day rate)`, amount: perDay * standbyDays });
  }

  const overtime = [...byDate.values()].reduce((a, d) => a + Math.max(0, d.hours - rules.dayHours), 0);
  if (overtime > 0) {
    lines.push({ key: "overtime", label: "Machine overtime", detail: `${overtime} h beyond ${rules.dayHours} h days, pro rata`, amount: round10(overtime * machine.dayRate / rules.dayHours) });
  }

  if (input.operator) {
    if (machine.operatorRate != null && machine.operatorRate > 0) {
      lines.push({ key: "operator", label: "Operator", detail: `${plural(onHire, "day")} × ${fmtGhs(machine.operatorRate)}`, amount: round10(machine.operatorRate * onHire) });
      if (overtime > 0) lines.push({ key: "op_overtime", label: "Operator overtime", detail: `${overtime} h at 1.5× the hourly operator rate`, amount: round10(overtime * machine.operatorRate / rules.dayHours * 1.5) });
    } else notes.push("Operator is included in the machine rate.");
  }

  if (input.fuel) {
    const litres = logs.reduce((a, l) => a + l.fuelL, 0);
    if (litres > 0 && rules.dieselPrice) lines.push({ key: "fuel", label: "Diesel supplied", detail: `${litres} L at ${fmtGhs(rules.dieselPrice)}/L`, amount: round10(litres * rules.dieselPrice) });
    else if (litres > 0) notes.push(`${litres} L of diesel supplied: no diesel price is set under Pricing, so add it at pump price.`);
    else notes.push("Fuel was by RINAMAS but no litres are logged.");
  }

  if (!machine.selfDrive) {
    if (input.transport && input.transport > 0) lines.push({ key: "transport", label: "Low bed, to site and back", detail: "as quoted", amount: input.transport });
    else notes.push("Low bed transport was not priced on this request: add it if it applies.");
  }

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const vat = rules.vatPct > 0 && !rules.vatIncluded ? round10(subtotal * rules.vatPct / 100) : 0;
  return { ok: true, lines, subtotal, vat, total: subtotal + vat, days: { onHire, worked, standby: standbyDays, source }, notes };
}

/* ---------- money on a hire record ---------- */

export type PaymentLike = { kind: string; amount: number };

/** Net received: refunds subtract. */
export const paidTotal = (payments: PaymentLike[]) => payments.reduce((a, p) => a + (p.kind === "refund" ? -p.amount : p.amount), 0);

/** What the job is billed at: the final bill once set, else the quote, else nothing yet. */
export const billOf = (q: { finalAmount: number | null; quotedAmount: number | null }) => q.finalAmount ?? q.quotedAmount ?? null;

/** Balance still owed (negative = RINAMAS owes the customer). Null while there is nothing to bill against. */
export function balanceOf(q: { finalAmount: number | null; quotedAmount: number | null }, payments: PaymentLike[]): number | null {
  const bill = billOf(q);
  return bill == null ? null : bill - paidTotal(payments);
}

export const PAYMENT_KINDS = { deposit: "Deposit", balance: "Balance", extra: "Extra charge", refund: "Refund" } as const;
export const PAYMENT_METHODS = { momo: "MoMo", bank: "Bank transfer", cash: "Cash", cheque: "Cheque" } as const;
