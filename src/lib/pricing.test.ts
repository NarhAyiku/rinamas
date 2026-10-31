// Run with: npm test  (node --test, Node 22.6+ strips the types)
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit .ts extension (tsconfig allows it)
import { DEFAULT_RULES, daysFromDuration, estimate, estimateText, hireCost, ladder, round10, type RateMachine, type RateZone, type Rules } from "./pricing.ts";

const excavator: RateMachine = { id: "m1", name: "JCB excavator, 20T class", dayRate: 8500, rateUnit: "day", operatorRate: 500, fuelLPerDay: 120, selfDrive: false, priceOnRequest: false };
const tipper: RateMachine = { id: "m2", name: "Tipper truck, 10 m³", dayRate: 2500, rateUnit: "day", operatorRate: null, fuelLPerDay: null, selfDrive: true, priceOnRequest: false };
const lowbed: RateMachine = { id: "m3", name: "Low bed trailer, 60T", dayRate: 2800, rateUnit: "trip", operatorRate: null, fuelLPerDay: null, selfDrive: true, priceOnRequest: false };
const piling: RateMachine = { ...excavator, id: "m4", name: "Piling rig", dayRate: 14000, priceOnRequest: true };
const zoneA: RateZone = { id: "zA", name: "A", label: "Within 30 km of the yard", towns: "Madina, Adenta, Tema, Kasoa", maxKm: 30, lowBedEachWay: 1500 };
const zoneC: RateZone = { id: "zC", name: "C", label: "60 to 120 km", towns: "Koforidua, Akosombo, Ada", maxKm: 120, lowBedEachWay: 4000 };
const rules: Rules = { ...DEFAULT_RULES, dieselPrice: 13.5 };

const amount = (est: ReturnType<typeof estimate>, key: string) => (est.ok ? est.lines.find((l) => l.key === key)?.amount : undefined);

test("worked example: 20T excavator, 5 days, Zone C, with operator and fuel, VAT off = GH₵ 61,100", () => {
  const est = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: true, rules });
  assert.equal(est.ok, true);
  if (!est.ok) return;
  assert.equal(amount(est, "hire"), 42_500);
  assert.equal(amount(est, "transport"), 8_000);
  assert.equal(amount(est, "operator"), 2_500);
  assert.equal(amount(est, "fuel"), 8_100);
  assert.equal(est.subtotal, 61_100);
  assert.equal(est.vat, 0);
  assert.equal(est.total, 61_100);
  assert.equal(est.deposit, 30_550);
  assert.equal(est.basis, "5 days at the day rate");
  assert.ok(est.notes.some((n) => /8 metered hours/.test(n) && /1\.5×/.test(n)));
  assert.ok(est.notes.some((n) => /Standby .*50%/.test(n)));
  assert.ok(est.notes.some((n) => /confirms the figure in writing/.test(n)));
});

test("same job in Tema (Zone A) = GH₵ 56,100: the GH₵ 5,000 difference is the distance", () => {
  const est = estimate({ machine: excavator, days: 5, zone: zoneA, operator: true, fuel: true, rules });
  assert.equal(est.ok && est.total, 56_100);
  assert.equal(est.ok && est.deposit, 28_050);
});

test("ladder defaults reproduce the old hardcoded week (×6×0.9) and month (×26×0.8) table", () => {
  for (const d of [8500, 3500, 4500, 3800, 7000, 12000, 9500, 8000, 4000, 2500, 14000, 15000]) {
    const l = ladder(d);
    assert.equal(l.day, d);
    assert.equal(l.week, d * 6 * 0.9);
    assert.equal(l.month, d * 26 * 0.8);
  }
});

test("12 days prices as 2 weeks, cheaper than 12 day rates", () => {
  const h = hireCost(8500, 12);
  assert.equal(h.amount, 91_800);
  assert.ok(h.amount < 12 * 8500);
  assert.equal(h.basis, "2 weeks");
});

test("26 days prices as a month; 23 days rounds up to the month when that is cheaper", () => {
  assert.deepEqual([hireCost(8500, 26).amount, hireCost(8500, 26).basis], [176_800, "1 month"]);
  const h23 = hireCost(8500, 23);
  assert.equal(h23.amount, 176_800);
  assert.equal(h23.basis, "1 month");
  const h7 = hireCost(8500, 7);
  assert.equal(h7.basis, "1 week + 1 day");
  assert.equal(h7.amount, 45_900 + 8_500);
});

test("minimum hire is one day and fractional days round down to whole days", () => {
  assert.equal(hireCost(8500, 0).amount, 8500);
  const est = estimate({ machine: excavator, days: 2.7, zone: zoneA, operator: false, fuel: false, rules });
  assert.equal(est.ok && est.days, 2);
});

test("priceOnRequest machines return ok:false with the call-us reason", () => {
  const est = estimate({ machine: piling, days: 3, zone: zoneA, operator: true, fuel: true, rules });
  assert.deepEqual(est, { ok: false, reason: "Quoted per job after a site call" });
});

test("self-driven machines get no transport line; per-trip machines get neither transport nor operator", () => {
  const t = estimate({ machine: tipper, days: 3, zone: zoneC, operator: true, fuel: false, rules });
  assert.equal(t.ok, true);
  assert.equal(amount(t, "transport"), undefined);
  assert.equal(amount(t, "hire"), 7_500);
  const lb = estimate({ machine: lowbed, days: 1, zone: zoneC, trips: 2, operator: true, fuel: true, rules });
  assert.equal(lb.ok, true);
  if (!lb.ok) return;
  assert.deepEqual(lb.lines.map((l) => l.key), ["hire"]);
  assert.equal(lb.total, 5_600);
  assert.equal(lb.basis, "2 loaded trips");
});

test("null operatorRate means operator included: no operator line, a note instead", () => {
  const est = estimate({ machine: tipper, days: 2, zone: null, operator: true, fuel: false, rules });
  assert.equal(est.ok, true);
  assert.equal(amount(est, "operator"), undefined);
  assert.ok(est.ok && est.notes.some((n) => /Operator is included/.test(n)));
});

test("fuel line is skipped without a diesel price (or without fuelLPerDay) and a metered-litres note is added", () => {
  const noPrice = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: true, rules: DEFAULT_RULES });
  assert.equal(noPrice.ok && noPrice.total, 53_000);
  assert.equal(amount(noPrice, "fuel"), undefined);
  assert.ok(noPrice.ok && noPrice.notes.some((n) => /metered litres at pump price/.test(n)));
  const noBurn = estimate({ machine: { ...excavator, fuelLPerDay: null }, days: 5, zone: zoneC, operator: true, fuel: true, rules });
  assert.equal(amount(noBurn, "fuel"), undefined);
  const dry = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: false, rules });
  assert.equal(amount(dry, "fuel"), undefined);
  assert.equal(dry.ok && dry.total, 53_000);
});

test("no zone and no km: no transport line, a note that the low bed is quoted once the site is known", () => {
  const est = estimate({ machine: excavator, days: 5, zone: null, operator: false, fuel: false, rules });
  assert.equal(amount(est, "transport"), undefined);
  assert.equal(est.ok && est.total, 42_500);
  assert.ok(est.ok && est.notes.some((n) => /quoted once we know the site/.test(n)));
});

test("km beyond the zones: 2 loaded legs at perKmBeyond", () => {
  const est = estimate({ machine: excavator, days: 1, zone: null, km: 150, operator: false, fuel: false, rules });
  assert.equal(amount(est, "transport"), 150 * 18 * 2);
});

test("VAT off gives 0; VAT 15% adds a rounded line; vatIncluded adds no line", () => {
  const base = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: true, rules });
  assert.equal(base.ok && base.vat, 0);
  const vat = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: true, rules: { ...rules, vatPct: 15 } });
  assert.equal(vat.ok && vat.vat, round10(61_100 * 0.15));
  assert.equal(vat.ok && vat.total, 61_100 + 9_170);
  const incl = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: true, rules: { ...rules, vatPct: 15, vatIncluded: true } });
  assert.equal(incl.ok && incl.vat, 0);
  assert.equal(incl.ok && incl.total, 61_100);
  assert.ok(incl.ok && incl.notes.some((n) => /include VAT at 15%/.test(n)));
});

test("every amount is rounded to GH₵ 10", () => {
  assert.equal(round10(1234), 1230);
  assert.equal(round10(1235), 1240);
  const odd: RateMachine = { ...excavator, dayRate: 1234, operatorRate: 333, fuelLPerDay: 7 };
  const est = estimate({ machine: odd, days: 3, zone: { ...zoneA, lowBedEachWay: 1005 }, operator: true, fuel: true, rules: { ...rules, dieselPrice: 13.37 } });
  assert.equal(est.ok, true);
  if (!est.ok) return;
  for (const l of est.lines) assert.equal(l.amount % 10, 0, `${l.key} ${l.amount}`);
  assert.equal(est.total % 10, 0);
  assert.equal(est.deposit % 10, 0);
  assert.equal(ladder(1234).week, 6_660); // 1234 × 6 × .9 = 6663.6
});

test("deposit follows depositPct", () => {
  const est = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: true, rules: { ...rules, depositPct: 30 } });
  assert.equal(est.ok && est.deposit, 18_330);
});

test("daysFromDuration maps the legacy strings to days (upper end of a range)", () => {
  assert.equal(daysFromDuration("1 day"), 1);
  assert.equal(daysFromDuration("2–5 days"), 5);
  assert.equal(daysFromDuration("1 week"), 6);
  assert.equal(daysFromDuration("2–3 weeks"), 18);
  assert.equal(daysFromDuration("1 month"), 26);
  assert.equal(daysFromDuration("Longer than a month"), 52);
  assert.equal(daysFromDuration("5 days"), 5);
  assert.equal(daysFromDuration(""), null);
  assert.equal(daysFromDuration("whenever"), null);
});

test("estimateText lists the lines, the total and the deposit for WhatsApp", () => {
  const est = estimate({ machine: excavator, days: 5, zone: zoneC, operator: true, fuel: true, rules });
  const text = estimateText(est, { machineName: excavator.name, days: 5, zone: zoneC, reference: "RQ-TEST", reviewedAt: "2026-10-28", usdRate: "11.63" });
  assert.match(text, /RQ-TEST/);
  assert.match(text, /Zone C \(Koforidua, Akosombo, Ada\)/);
  assert.match(text, /TOTAL GH₵ 61,100 indicative · deposit GH₵ 30,550/);
  assert.match(text, /Rates reviewed 2026-10-28 at GH₵ 11.63 to the dollar/);
  const por = estimateText(estimate({ machine: piling, days: 1, operator: false, fuel: false, rules }), { machineName: piling.name, days: 1 });
  assert.match(por, /Quoted per job after a site call/);
});
