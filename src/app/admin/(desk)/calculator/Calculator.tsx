"use client";
import { useActionState, useMemo, useState } from "react";
import { applyEstimate } from "@/app/admin/actions";
import { CopyButton } from "@/components/CopyButton";
import { EstimateLines } from "@/components/QuoteForm";
import { daysFromDuration, estimate, estimateText, type RateMachine, type RateZone, type Rules } from "@/lib/pricing";

export type RequestOpt = {
  id: string; reference: string; name: string; machineName: string; machineId: string | null; days: number | null; duration: string;
  zoneId: string | null; operator: string; fuel: string; site: string; status: string;
};
type Initial = { machineId: string; days: string; zoneId: string; operator: string; fuel: string; requestId: string; km: string };

export function Calculator({ machines, zones, rules, reviewedAt, usdRate, requests, initial }: {
  machines: RateMachine[]; zones: RateZone[]; rules: Rules; reviewedAt: string | null; usdRate: string | null; requests: RequestOpt[]; initial: Initial;
}) {
  const req0 = requests.find((r) => r.id === initial.requestId);
  const [requestId, setRequestId] = useState(req0?.id ?? "");
  const [machineId, setMachineId] = useState(initial.machineId || req0?.machineId || "");
  const [days, setDays] = useState(initial.days || String(req0?.days ?? daysFromDuration(req0?.duration, rules) ?? 1));
  const [zoneId, setZoneId] = useState(initial.zoneId || req0?.zoneId || (initial.km ? "km" : zones[0]?.id ?? ""));
  const [km, setKm] = useState(initial.km || "");
  const [trips, setTrips] = useState("1");
  const [operator, setOperator] = useState<"with" | "without">((initial.operator || req0?.operator) === "without" ? "without" : "with");
  const [fuel, setFuel] = useState<"with" | "without">((initial.fuel || req0?.fuel) === "without" ? "without" : "with");
  const [state, action, pending] = useActionState(applyEstimate, undefined);

  const machine = machines.find((m) => m.id === machineId) ?? null;
  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const kmN = zoneId === "km" ? Number(km) || null : null;
  const est = useMemo(() => machine ? estimate({ machine, days: Number(days), zone, km: kmN, trips: Number(trips) || 1, operator: operator === "with", fuel: fuel === "with", rules }) : null, [machine, days, zone, kmN, trips, operator, fuel, rules]);
  const target = requests.find((r) => r.id === requestId);
  const text = est && machine ? estimateText(est, { machineName: machine.name, days: Number(days), zone, km: kmN, reference: target?.reference ?? null, reviewedAt, usdRate }) : "";

  function pickRequest(id: string) {
    setRequestId(id);
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    if (r.machineId) setMachineId(r.machineId);
    setDays(String(r.days ?? daysFromDuration(r.duration, rules) ?? 1));
    if (r.zoneId) setZoneId(r.zoneId);
    setOperator(r.operator === "without" ? "without" : "with");
    setFuel(r.fuel === "without" ? "without" : "with");
  }

  return (
    <div className="calc">
      <div className="panel" style={{ display: "grid", gap: ".9rem" }}>
        <label className="f">Machine
          <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">Choose a machine</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}{m.priceOnRequest ? " (price on request)" : ""}</option>)}
          </select>
        </label>
        <div className="inline-form">
          <label className="f">Days<input type="number" min={1} max={365} step={1} value={days} onChange={(e) => setDays(e.target.value)} /></label>
          {machine?.rateUnit === "trip" && <label className="f">Loaded trips<input type="number" min={1} max={100} step={1} value={trips} onChange={(e) => setTrips(e.target.value)} /></label>}
        </div>
        <div className="day-chips" aria-label="Common durations">
          {([["1 day", 1], ["1 week", rules.weekDays], ["2 weeks", rules.weekDays * 2], ["1 month", rules.monthDays]] as [string, number][]).map(([label, n]) => (
            <button key={label} type="button" className="chip" aria-pressed={Number(days) === n} onClick={() => setDays(String(n))}>{label}{n > 1 ? ` · ${n}` : ""}</button>
          ))}
        </div>
        <label className="f">Distance from the N1 yard
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            {zones.map((z) => <option key={z.id} value={z.id}>Zone {z.name} · {z.label} · {z.towns} · GH₵ {z.lowBedEachWay.toLocaleString("en-GH")} each way</option>)}
            <option value="km">Beyond the zones: enter km</option>
            <option value="">Not known yet (low bed quoted later)</option>
          </select>
        </label>
        {zoneId === "km" && <label className="f">Road km one way<input type="number" min={1} max={2000} value={km} onChange={(e) => setKm(e.target.value)} placeholder="e.g. 250 to Kumasi" /></label>}
        <div className="radio" role="radiogroup" aria-label="Operator">
          <span>Operator</span>
          <label><input type="radio" name="operator-ui" checked={operator === "with"} onChange={() => setOperator("with")} /> With operator</label>
          <label><input type="radio" name="operator-ui" checked={operator === "without"} onChange={() => setOperator("without")} /> Machine only</label>
        </div>
        <div className="radio" role="radiogroup" aria-label="Fuel">
          <span>Fuel</span>
          <label><input type="radio" name="fuel-ui" checked={fuel === "with"} onChange={() => setFuel("with")} /> With fuel</label>
          <label><input type="radio" name="fuel-ui" checked={fuel === "without"} onChange={() => setFuel("without")} /> Customer&apos;s fuel</label>
        </div>
        {machine && <p className="hint" style={{ margin: 0 }}>
          {machine.name}: GH₵ {machine.dayRate.toLocaleString("en-GH")} per {machine.rateUnit === "trip" ? "loaded trip" : `${rules.dayHours}-hour day`}
          {machine.operatorRate != null ? ` · operator GH₵ ${machine.operatorRate.toLocaleString("en-GH")}/day` : " · operator included"}
          {machine.fuelLPerDay ? ` · about ${machine.fuelLPerDay} L diesel/day` : " · no diesel allowance set"}
          {machine.selfDrive ? " · drives itself to site" : ""}
        </p>}
      </div>

      <div className="estimate calc-result" aria-live="polite">
        <div className="estimate-head"><p className="eyebrow">Estimate</p>{est?.ok && <span className="muted" style={{ fontSize: ".85rem" }}>{est.basis}{zone ? ` · Zone ${zone.name}` : kmN ? ` · ${kmN} km` : ""}</span>}</div>
        {!machine ? <p className="est-empty">Pick a machine to start.</p>
          : !est ? null
          : !est.ok ? <p className="est-empty"><b>{est.reason}.</b></p>
          : <EstimateLines est={est} />}
        <p className="est-disclaimer">Rates{reviewedAt ? ` reviewed ${reviewedAt}` : " on the current card"}{usdRate ? `, GH₵ ${usdRate} to the dollar` : ""}. Indicative until confirmed in writing.</p>
        <div className="row-form">
          {est?.ok && <CopyButton text={text} className="btn btn-ghost btn-sm" />}
          {est?.ok && target && <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">Share on WhatsApp</a>}
        </div>

        <form action={action} className="apply-form">
          <input type="hidden" name="machineId" value={machineId} />
          <input type="hidden" name="days" value={days} />
          <input type="hidden" name="zoneId" value={zone ? zone.id : ""} />
          <input type="hidden" name="km" value={kmN ?? ""} />
          <input type="hidden" name="trips" value={trips} />
          <input type="hidden" name="operator" value={operator} />
          <input type="hidden" name="fuel" value={fuel} />
          <label className="f">Apply to request
            <select name="quoteId" value={requestId} onChange={(e) => pickRequest(e.target.value)}>
              <option value="">Choose an open request</option>
              {requests.map((r) => <option key={r.id} value={r.id}>{r.reference} · {r.name} · {r.machineName}{r.status === "quoted" ? " (quoted)" : ""}</option>)}
            </select>
          </label>
          <button className="btn btn-accent btn-sm" type="submit" disabled={pending || !est?.ok || !requestId}>{pending ? "Applying…" : "Apply as the quote"}</button>
          {target && <span className="hint" style={{ margin: 0, flexBasis: "100%" }}>Sets the quoted total, days and zone on {target.reference} ({target.site}) and logs it. <a href={`/admin/requests/${target.id}`}>Open the record</a>.</span>}
          {state?.error && <p className="err" role="alert" style={{ flexBasis: "100%" }}>{state.error}</p>}
          {state?.ok && <p className="ok" role="status" style={{ flexBasis: "100%" }}>{state.ok}</p>}
        </form>
      </div>
    </div>
  );
}
