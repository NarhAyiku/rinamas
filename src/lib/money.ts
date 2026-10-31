import type { Machine, HourLog, QuoteRequest } from "@prisma/client";
import type { EstimateOk } from "./pricing";
import type { Rules } from "./pricing";
import { toRateMachine } from "./rates";
import { settle, type Settlement } from "./settle";

/** What the API and the calculator store in estimateJson. */
export type Snapshot = EstimateOk & {
  machineName?: string; zone?: { id: string; name: string; label: string; towns: string } | null; km?: number | null;
  operator?: boolean; fuel?: boolean; reviewedAt?: string | null; usdRate?: string | null; computedAt?: string; source?: string; by?: string;
};

export function parseSnapshot(json: string | null): Snapshot | null {
  if (!json) return null;
  try { const v = JSON.parse(json); return v && v.ok === true && Array.isArray(v.lines) ? (v as Snapshot) : null; } catch { return null; }
}

/** Settlement for a hire record from its dates, hour log and quoted transport; null without a listed machine. */
export function settlementFor(q: QuoteRequest & { machine: Machine | null; hourLogs: HourLog[] }, rules: Rules): Settlement | null {
  if (!q.machine) return null;
  const snap = parseSnapshot(q.estimateJson);
  return settle({
    machine: toRateMachine(q.machine), rules,
    dispatchDate: q.dispatchDate, returnDate: q.returnDate,
    logs: q.hourLogs, fallbackDays: q.days,
    operator: q.operator === "with", fuel: q.fuel === "with",
    transport: snap?.lines.find((l) => l.key === "transport")?.amount ?? null,
  });
}
