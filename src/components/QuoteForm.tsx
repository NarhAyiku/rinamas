"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DISPATCH_PHONE } from "@/lib/contact";
import { estimate, fmtGhs, type EstimateOk, type RateTable } from "@/lib/pricing";

export type { RateTable } from "@/lib/pricing";

type Opt = { id: string; name: string };

const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Itemised lines, total, deposit and notes. Shared by the public estimate panel and the staff calculator. */
export function EstimateLines({ est }: { est: EstimateOk }) {
  return (
    <>
      <dl className="est-lines">
        {est.lines.map((l) => <div key={l.key}><dt><b>{l.label}</b><small>{l.detail}</small></dt><dd>{fmtGhs(l.amount)}</dd></div>)}
        {est.vat > 0 && <div><dt><b>VAT</b></dt><dd>{fmtGhs(est.vat)}</dd></div>}
      </dl>
      <div className="est-total"><span>Estimated total</span><b>{fmtGhs(est.total)}</b><small>A deposit of {fmtGhs(est.deposit)} holds the machine and your date; the rest is settled against your signed hour log.</small></div>
      <ul className="est-notes">{est.notes.filter((n) => !n.startsWith("Indicative")).map((n) => <li key={n}>{n}</li>)}</ul>
    </>
  );
}

export function QuoteForm({ machines, rates }: { machines: Opt[]; rates?: RateTable }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machineId, setMachineId] = useState("");
  const [days, setDays] = useState("1");
  const [zoneId, setZoneId] = useState("");
  const [operator, setOperator] = useState<"with" | "without">("with");
  const [fuel, setFuel] = useState<"with" | "without">("with");
  const today = new Date().toISOString().slice(0, 10);
  const rules = rates?.rules;
  const chips: [string, number][] = rules
    ? [["1 day", 1], ["1 week", rules.weekDays], ["2 weeks", rules.weekDays * 2], ["1 month", rules.monthDays]]
    : [["1 day", 1], ["1 week", 6], ["2 weeks", 12], ["1 month", 26]];

  const est = useMemo(() => {
    if (!rates || !rates.showPrices) return null;
    const m = rates.machines.find((x) => x.id === machineId);
    if (!m) return null;
    return estimate({ machine: m, days: Number(days), zone: rates.zones.find((z) => z.id === zoneId) ?? null, operator: operator === "with", fuel: fuel === "with", rules: rates.rules });
  }, [rates, machineId, days, zoneId, operator, fuel]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again or call dispatch."); setBusy(false); return; }
      router.push(`/quote/${data.id}`);
    } catch {
      setError(`We couldn't send that. Check your connection and try again, or call ${DISPATCH_PHONE.display}.`);
      setBusy(false);
    }
  }

  // Fleet cards set this select's value directly and then focus it, so sync state on focus as well as change.
  const syncMachine = (e: React.SyntheticEvent<HTMLSelectElement>) => setMachineId(e.currentTarget.value);

  return (
    <form className="card" onSubmit={onSubmit}>
      <label className="f full">Machine
        <select id="machine" name="machineId" required defaultValue="" onChange={syncMachine} onFocus={syncMachine}>
          <option value="" disabled>Choose a machine class</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="f">Start date<input id="start" name="startDate" type="date" min={today} required /></label>
      <div className="f" style={{ display: "grid", gap: ".3rem" }}>
        <label className="f">How many days
          <input id="days" name="days" type="number" inputMode="numeric" min={1} max={365} step={1} value={days} onChange={(e) => setDays(e.target.value)} required />
        </label>
        <div className="day-chips" aria-label="Common durations">
          {chips.map(([label, n]) => <button key={label} type="button" className="chip" aria-pressed={Number(days) === n} onClick={() => setDays(String(n))}>{label}{n > 1 ? ` · ${n}` : ""}</button>)}
        </div>
      </div>
      {rates && rates.zones.length > 0 && (
        <label className="f full">How far from our N1 yard, Accra
          <select id="zone" name="zoneId" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            {rates.zones.map((z) => <option key={z.id} value={z.id}>Zone {z.name} · {z.label.charAt(0).toLowerCase() + z.label.slice(1)} · {z.towns}</option>)}
            <option value="">Further away / not sure</option>
          </select>
        </label>
      )}
      <label className="f full">Site location<input id="site" name="site" type="text" placeholder="e.g. Oyibi, near the Valley View junction" required /></label>
      <div className="full radio" role="radiogroup" aria-label="Operator">
        <span>Operator</span>
        <label><input type="radio" name="operator" value="with" checked={operator === "with"} onChange={() => setOperator("with")} /> With operator</label>
        <label><input type="radio" name="operator" value="without" checked={operator === "without"} onChange={() => setOperator("without")} /> Machine only</label>
      </div>
      <div className="full radio" role="radiogroup" aria-label="Fuel">
        <span>Fuel</span>
        <label><input type="radio" name="fuel" value="with" checked={fuel === "with"} onChange={() => setFuel("with")} /> With fuel from RINAMAS</label>
        <label><input type="radio" name="fuel" value="without" checked={fuel === "without"} onChange={() => setFuel("without")} /> Without fuel, we buy our own</label>
      </div>
      <p className="full hint">With fuel, we deliver diesel to site and bill it on the metered hours. Without fuel, the machine arrives with a full tank and you send it back full.</p>

      {rates && (
        <div className="estimate" aria-live="polite">
          <div className="estimate-head"><p className="eyebrow">Your estimate</p>{est?.ok && <span className="muted" style={{ fontSize: ".85rem" }}>{est.basis}{zoneId ? ` · Zone ${rates.zones.find((z) => z.id === zoneId)?.name}` : ""}</span>}</div>
          {!rates.showPrices ? (
            <p className="est-empty"><b>Today&apos;s rate. Your call.</b> Send this form and we&apos;ll reply with a written quote within the working day, or call <a href={`tel:${DISPATCH_PHONE.tel}`}>{DISPATCH_PHONE.display}</a> for a price now.</p>
          ) : !machineId ? (
            <p className="est-empty">Choose a machine, days and zone and you&apos;ll see an itemised estimate here before you send anything.</p>
          ) : machineId === "other" ? (
            <p className="est-empty">Tell us what you need in the notes and we&apos;ll price it for your job.</p>
          ) : !est ? null : !est.ok ? (
            <p className="est-empty"><b>{est.reason}.</b> Send the request and we&apos;ll call you back with a written figure.</p>
          ) : (
            <>
              <EstimateLines est={est} />
              <p className="est-disclaimer">A guide figure at rates{rates.reviewedAt ? ` reviewed ${fmtDay(rates.reviewedAt)}` : " on the current rate card"}{rates.usdRate ? `, GH₵ ${rates.usdRate} to the dollar` : ""}. Your written quote confirms it, and once you accept, that rate is locked for your whole hire.</p>
            </>
          )}
        </div>
      )}

      <label className="f">Your name<input id="name" name="name" type="text" required /></label>
      <label className="f">Your phone<input id="phone" name="phone" type="tel" placeholder="024 000 0000" required /></label>
      <label className="f full">Job notes<textarea id="notes" name="notes" placeholder="What the machine will do, ground conditions, access for the low bed" /></label>
      {error && <p className="full err" role="alert">{error}</p>}
      <div className="full"><button className="btn btn-accent" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Sending…" : "Send quote request"}</button></div>
    </form>
  );
}
