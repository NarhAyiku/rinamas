"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DISPATCH_PHONE } from "@/lib/contact";

type Opt = { id: string; name: string };

export function QuoteForm({ machines }: { machines: Opt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

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
      setError(`Could not reach the server. Check your connection or call ${DISPATCH_PHONE.display}.`);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <label className="f full">Machine
        <select id="machine" name="machineId" required defaultValue="">
          <option value="" disabled>Choose a machine class</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="f">Start date<input id="start" name="startDate" type="date" min={today} required /></label>
      <label className="f">Duration
        <select id="duration" name="duration" defaultValue="1 day">
          {["1 day", "2–5 days", "1 week", "2–3 weeks", "1 month", "Longer than a month"].map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <label className="f full">Site location<input id="site" name="site" type="text" placeholder="e.g. Oyibi, near the Valley View junction" required /></label>
      <div className="full radio" role="radiogroup" aria-label="Operator">
        <span>Operator</span>
        <label><input type="radio" name="operator" value="with" defaultChecked /> With operator</label>
        <label><input type="radio" name="operator" value="without" /> Machine only</label>
      </div>
      <div className="full radio" role="radiogroup" aria-label="Fuel">
        <span>Fuel</span>
        <label><input type="radio" name="fuel" value="with" defaultChecked /> With fuel from RINAMAS</label>
        <label><input type="radio" name="fuel" value="without" /> Without fuel, we buy our own</label>
      </div>
      <p className="full hint">With fuel: diesel is delivered to site and billed on the metered hours. Without fuel: the machine arrives with a full tank, you fuel it on site and return it full.</p>
      <label className="f">Your name<input id="name" name="name" type="text" required /></label>
      <label className="f">Your phone<input id="phone" name="phone" type="tel" placeholder="024 000 0000" required /></label>
      <label className="f full">Job notes<textarea id="notes" name="notes" placeholder="What the machine will do, ground conditions, access for the low bed" /></label>
      {error && <p className="full err" role="alert">{error}</p>}
      <div className="full"><button className="btn btn-accent" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Sending…" : "Send quote request"}</button></div>
    </form>
  );
}
