"use client";
import { useActionState, useState } from "react";
import { saveMachine } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/format";

export type MachineFormData = {
  id: string; name: string; slug: string; category: string; categoryLabel: string; dayRate: number; rateUnit: string;
  operatorRate: number | null; sortOrder: number; image: string; specsText: string; available: boolean;
};

const MAX_MB = 5;

export function MachineForm({ m }: { m?: MachineFormData }) {
  const [state, action, pending] = useActionState(saveMachine, undefined);
  const [fileNote, setFileNote] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) { setFileNote(null); return; }
    const mb = f.size / 1024 / 1024;
    setFileNote(mb > MAX_MB ? `This photo is ${mb.toFixed(1)} MB. It must be under ${MAX_MB} MB; resize it or pick a smaller one.` : `${f.name} · ${mb.toFixed(1)} MB`);
  }

  return (
    <form action={action} className="panel" style={{ display: "grid", gap: ".8rem" }}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="inline-form">
        <label className="f">Name<input name="name" defaultValue={m?.name} required /></label>
        <label className="f">Slug<input name="slug" defaultValue={m?.slug} pattern="[a-z0-9\-]+" title="Lowercase letters, numbers and dashes, e.g. jcb-telehandler" required /></label>
        <label className="f">Category<select name="category" defaultValue={m?.category ?? "earth"}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="f">Category label<input name="categoryLabel" defaultValue={m?.categoryLabel} placeholder="Lifting · Telehandler" required /></label>
      </div>
      <div className="inline-form">
        <label className="f">Rate (GH₵)<input name="dayRate" type="number" min={0} defaultValue={m?.dayRate ?? 0} required /></label>
        <label className="f">Per<select name="rateUnit" defaultValue={m?.rateUnit ?? "day"}><option value="day">day</option><option value="trip">trip</option></select></label>
        <label className="f">Operator / day (blank = included)<input name="operatorRate" type="number" min={0} defaultValue={m?.operatorRate ?? ""} /></label>
        <label className="f">Sort order<input name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 99} /></label>
      </div>
      <div className="inline-form">
        <label className="f">Photo{m ? " (choose a file to replace it)" : ""}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} /></label>
        <label className="f">Or image path<input name="image" defaultValue={m?.image ?? ""} placeholder="/img/machine.jpg or https://…" /></label>
      </div>
      {fileNote && <p className="hint" style={{ margin: 0 }}>{fileNote}</p>}
      <label className="f">Specs, one per line as Label: value<textarea name="specs" defaultValue={m?.specsText ?? ""} rows={4} placeholder={"Lift capacity: 4 T\nLift height: 17 m\nBest for: Blockwork, roofing"} /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      <div className="row-form">
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}><input type="checkbox" name="available" defaultChecked={m?.available ?? true} /> Available for hire</label>
        <button className="btn btn-accent btn-sm" type="submit" disabled={pending}>{pending ? "Saving…" : m ? "Save changes" : "Add machine"}</button>
      </div>
    </form>
  );
}
