"use client";
import { useActionState } from "react";
import { saveZone, seedDefaultZones, setZoneActive } from "@/app/admin/actions";

export type ZoneRowData = { id: string; name: string; label: string; towns: string; maxKm: number; lowBedEachWay: number; sortOrder: number; active: boolean };

function ZoneRow({ z }: { z?: ZoneRowData }) {
  const [state, action, pending] = useActionState(saveZone, undefined);
  return (
    <form action={action} className="zone-row">
      {z && <input type="hidden" name="id" value={z.id} />}
      <label className="f">Zone<input name="name" defaultValue={z?.name ?? ""} maxLength={12} placeholder="D" required style={{ textTransform: "uppercase" }} /></label>
      <label className="f">Band<input name="label" defaultValue={z?.label ?? ""} placeholder="120 to 250 km" required /></label>
      <label className="f">Towns, comma separated<input name="towns" defaultValue={z?.towns ?? ""} placeholder="Cape Coast, Ho, Kumasi" required /></label>
      <label className="f">Up to km<input name="maxKm" type="number" min={1} max={2000} defaultValue={z?.maxKm ?? ""} required /></label>
      <label className="f">Low bed each way GH₵<input name="lowBedEachWay" type="number" min={0} step={10} defaultValue={z?.lowBedEachWay ?? ""} required /></label>
      <label className="f">Order<input name="sortOrder" type="number" defaultValue={z?.sortOrder ?? 0} /></label>
      <div className="zone-actions"><button className="btn btn-accent btn-sm" type="submit" disabled={pending}>{pending ? "Saving…" : z ? "Save" : "Add zone"}</button></div>
      {state?.error && <p className="err zone-msg" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok zone-msg" role="status">{state.ok}</p>}
    </form>
  );
}

export function ZonesTable({ zones, isSuper }: { zones: ZoneRowData[]; isSuper: boolean }) {
  return (
    <div className="zones">
      {zones.length === 0 && (
        <div className="empty">
          <b>No transport zones yet.</b>
          <span>Without zones the estimator leaves the low bed line out and says it will be quoted. {isSuper ? "Seed the three default bands (A ≤ 30 km, B ≤ 60 km, C ≤ 120 km) with placeholder prices, then put in RINAMAS's real low bed costs." : "Ask the super admin to seed the default zones."}</span>
          {isSuper && <form action={seedDefaultZones} style={{ marginTop: ".6rem" }}><button className="btn btn-accent btn-sm" type="submit">Seed default zones</button></form>}
        </div>
      )}
      {zones.map((z) => (
        <div key={z.id} className={`zone-card${z.active ? "" : " inactive"}`}>
          <div className="zone-head">
            <b>Zone {z.name}</b>
            <span className="muted">{z.label} · up to {z.maxKm} km</span>
            <span className={`pill ${z.active ? "pill-confirmed" : "pill-closed"}`}><i aria-hidden="true" />{z.active ? "In use" : "Inactive"}</span>
            <form action={setZoneActive} style={{ marginLeft: "auto" }}>
              <input type="hidden" name="id" value={z.id} /><input type="hidden" name="active" value={z.active ? "0" : "1"} />
              <button className="link" type="submit">{z.active ? "Deactivate" : "Reactivate"}</button>
            </form>
          </div>
          <ZoneRow z={z} />
        </div>
      ))}
      <details className="zone-card" style={{ gap: 0 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Add a zone</summary>
        <div style={{ marginTop: ".8rem" }}><ZoneRow /></div>
      </details>
    </div>
  );
}
