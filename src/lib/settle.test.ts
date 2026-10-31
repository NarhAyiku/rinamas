// Run with: npm test  (node --test, Node 22.6+ strips the types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES, type RateMachine, type Rules } from "./pricing.ts";
import { balanceOf, billOf, daysOnHire, paidTotal, settle } from "./settle.ts";

const excavator: RateMachine = { id: "m1", name: "JCB excavator, 20T class", dayRate: 8500, rateUnit: "day", operatorRate: 500, fuelLPerDay: 120, selfDrive: false, priceOnRequest: false };
const tipper: RateMachine = { id: "m2", name: "Tipper truck, 10 m³", dayRate: 2500, rateUnit: "day", operatorRate: null, fuelLPerDay: null, selfDrive: true, priceOnRequest: false };
const lowbed: RateMachine = { id: "m3", name: "Low bed trailer, 60T", dayRate: 2800, rateUnit: "trip", operatorRate: null, fuelLPerDay: null, selfDrive: true, priceOnRequest: false };
const rules: Rules = { ...DEFAULT_RULES, dieselPrice: 13.5 };
const amount = (s: ReturnType<typeof settle>, key: string) => (s.ok ? s.lines.find((l) => l.key === key)?.amount : undefined);
const day = (date: string, hours = 8, standby = 0, fuelL = 0) => ({ date, hours, standby, fuelL });

test("days on hire count dispatch and return days both", () => {
  assert.equal(daysOnHire("2026-11-02", "2026-11-11"), 10);
  assert.equal(daysOnHire("2026-11-02", "2026-11-02"), 1);
  assert.equal(daysOnHire("2026-11-05", "2026-11-02"), null);
  assert.equal(daysOnHire(null, "2026-11-02"), null);
});

test("10 days on hire with operator and transport matches the worked estimate (GH₵ 89,900)", () => {
  const s = settle({ machine: excavator, rules, dispatchDate: "2026-11-02", returnDate: "2026-11-11", logs: [], operator: true, fuel: false, transport: 5000 });
  assert.equal(s.ok, true);
  if (!s.ok) return;
  assert.equal(amount(s, "hire"), 79_900); // 1 week + 4 days
  assert.equal(amount(s, "operator"), 5_000);
  assert.equal(amount(s, "transport"), 5_000);
  assert.equal(s.total, 89_900);
  assert.deepEqual(s.days, { onHire: 10, worked: 10, standby: 0, source: "dates" });
});

test("rain days are standby at 50%, overtime is pro rata and operator overtime 1.5×", () => {
  const logs = [day("2026-11-02", 10), day("2026-11-03", 0, 8), day("2026-11-04", 8), day("2026-11-05", 9)];
  const s = settle({ machine: excavator, rules, dispatchDate: "2026-11-02", returnDate: "2026-11-05", logs, operator: true, fuel: false, transport: 3000 });
  assert.equal(s.ok, true);
  if (!s.ok) return;
  assert.equal(s.days.standby, 1);
  assert.equal(amount(s, "hire"), 25_500);       // 3 worked days × 8,500
  assert.equal(amount(s, "standby"), 4_250);     // 1 × 50% of 8,500
  assert.equal(amount(s, "overtime"), 3_190);    // 3 h × 8,500 / 8 = 3,187.5 → 3,190
  assert.equal(amount(s, "operator"), 2_000);    // 4 days × 500, standby days included
  assert.equal(amount(s, "op_overtime"), 280);   // 3 h × 62.5 × 1.5 = 281.25 → 280
  assert.equal(s.total, 25_500 + 4_250 + 3_190 + 2_000 + 280 + 3_000);
});

test("diesel supplied is billed on logged litres at the diesel price, or flagged when no price is set", () => {
  const logs = [day("2026-11-02", 8, 0, 100), day("2026-11-03", 8, 0, 120)];
  const s = settle({ machine: excavator, rules, logs, operator: false, fuel: true, transport: null });
  assert.equal(s.ok && s.days.source, "logs");
  assert.equal(amount(s, "fuel"), 2_970); // 220 L × 13.5
  const noPrice = settle({ machine: excavator, rules: { ...rules, dieselPrice: null }, logs, operator: false, fuel: true });
  assert.equal(amount(noPrice, "fuel"), undefined);
  assert.ok(noPrice.ok && noPrice.notes.some((n) => /220 L/.test(n)));
});

test("self-driving machines carry no low bed; per-trip machines and missing days are refused", () => {
  const s = settle({ machine: tipper, rules, logs: [], fallbackDays: 3, operator: false, fuel: false, transport: 5000 });
  assert.equal(s.ok && s.days.source, "request");
  assert.equal(amount(s, "transport"), undefined);
  assert.equal(settle({ machine: lowbed, rules, logs: [], fallbackDays: 1, operator: false, fuel: false }).ok, false);
  assert.equal(settle({ machine: excavator, rules, logs: [], operator: false, fuel: false }).ok, false);
});

test("balance is the final bill (else the quote) less payments, refunds subtracting", () => {
  const pays = [{ kind: "deposit", amount: 40_000 }, { kind: "balance", amount: 50_000 }, { kind: "refund", amount: 100 }];
  assert.equal(paidTotal(pays), 89_900);
  assert.equal(balanceOf({ finalAmount: 89_900, quotedAmount: 85_000 }, pays), 0);
  assert.equal(balanceOf({ finalAmount: null, quotedAmount: 85_000 }, pays.slice(0, 1)), 45_000);
  assert.equal(balanceOf({ finalAmount: null, quotedAmount: null }, pays), null);
  assert.equal(billOf({ finalAmount: null, quotedAmount: 85_000 }), 85_000);
});
