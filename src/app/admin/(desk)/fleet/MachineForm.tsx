"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveMachine } from "@/app/admin/actions";
import { suggestMachineFromPhoto } from "@/app/admin/ai-actions";
import type { MachineSuggestion } from "@/lib/ai-machine";
import { CATEGORIES } from "@/lib/format";

export type MachineFormData = {
  id: string; name: string; slug: string; category: string; categoryLabel: string; dayRate: number; rateUnit: string;
  operatorRate: number | null; sortOrder: number; image: string; specsText: string; available: boolean; priceOnRequest: boolean;
  fuelLPerDay: number | null; selfDrive: boolean;
};

const MAX_MB = 5;
const AI_MAX_PX = 1280;

type AiStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "done"; filled: number; confidence: string; notes: string }
  | { kind: "error"; error: string };

/** Downscale in the browser so the AI request stays small: max 1280 px long side, JPEG 0.85. */
async function downscale(file: File): Promise<Blob> {
  let src: CanvasImageSource;
  let w: number, h: number;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    src = bitmap; w = bitmap.width; h = bitmap.height;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      src = img; w = img.naturalWidth; h = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const scale = Math.min(1, AI_MAX_PX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff"; // PNG transparency -> white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("could not encode");
  return blob;
}

export function MachineForm({ m }: { m?: MachineFormData }) {
  const [state, action, pending] = useActionState(saveMachine, undefined);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);
  const [ai, setAi] = useState<AiStatus>({ kind: "idle" });
  const [aiFields, setAiFields] = useState<Set<string>>(() => new Set());
  const [canFill, setCanFill] = useState(false); // editing: a usable new photo is chosen

  // React resets the form after a successful save: drop the AI markers with it.
  useEffect(() => {
    if (state?.ok) { setAi({ kind: "idle" }); setAiFields(new Set()); setCanFill(false); setFileNote(null); }
  }, [state]);

  function apply(sg: MachineSuggestion): number {
    const form = formRef.current;
    if (!form) return 0;
    const filled = new Set<string>();
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!el) return;
      el.value = value;
      filled.add(name);
    };
    set("name", sg.name);
    if (!m) set("slug", sg.slug); // an existing machine keeps its slug (page anchors, catalogue sync)
    set("category", sg.category);
    set("categoryLabel", sg.categoryLabel);
    set("specs", sg.specs.map((s) => `${s.label}: ${s.value}`).join("\n"));
    set("rateUnit", sg.rateUnit);
    set("operatorRate", sg.operatorRate == null ? "" : String(sg.operatorRate));
    set("fuelLPerDay", sg.fuelLPerDay == null ? "" : String(sg.fuelLPerDay));
    const selfDrive = form.elements.namedItem("selfDrive") as HTMLInputElement | null;
    if (selfDrive) { selfDrive.checked = sg.selfDrive; filled.add("selfDrive"); }
    // Never overwrite a rate someone already set; only fill an empty/0 rate on a new machine.
    const rate = form.elements.namedItem("dayRate") as HTMLInputElement | null;
    if (!m && rate && sg.dayRate != null && (rate.value.trim() === "" || Number(rate.value) === 0)) {
      rate.value = String(sg.dayRate);
      filled.add("dayRate");
    }
    setAiFields(filled);
    return filled.size;
  }

  async function readPhoto(file: File) {
    const id = ++runId.current;
    setAi({ kind: "pending" });
    try {
      let blob: Blob = file;
      try { blob = await downscale(file); } catch { /* send the original; the server checks type and size */ }
      const fd = new FormData();
      fd.append("photo", blob, blob === file ? file.name : "photo.jpg");
      if (m) fd.append("id", m.id);
      const res = await suggestMachineFromPhoto(fd);
      if (id !== runId.current) return; // a newer photo was chosen meanwhile
      if (!res.ok) { setAi({ kind: "error", error: res.error }); return; }
      const n = apply(res.suggestion);
      setAi({ kind: "done", filled: n, confidence: res.suggestion.confidence, notes: res.suggestion.notes });
    } catch {
      if (id !== runId.current) return;
      setAi({ kind: "error", error: "Could not reach the AI to read the photo. Check the connection and try again, or fill the fields by hand." });
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    runId.current++; // ignore any reading still in flight for the previous photo
    setAi({ kind: "idle" });
    if (!f) { setFileNote(null); setCanFill(false); return; }
    const mb = f.size / 1024 / 1024;
    const tooBig = mb > MAX_MB;
    setFileNote(tooBig ? `This photo is ${mb.toFixed(1)} MB. It must be under ${MAX_MB} MB; resize it or pick a smaller one.` : `${f.name} · ${mb.toFixed(1)} MB`);
    if (tooBig) { setCanFill(false); return; }
    if (m) setCanFill(true);
    else void readPhoto(f);
  }

  function onFillClick() {
    const f = photoRef.current?.files?.[0];
    if (f) void readPhoto(f);
  }

  // Any edit by the admin removes that field's AI marker.
  function onEdit(e: React.FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name;
    if (name && aiFields.has(name)) setAiFields((prev) => { const next = new Set(prev); next.delete(name); return next; });
  }

  const ai$ = (name: string) => (aiFields.has(name) ? "f ai-filled" : "f");
  const tag = (name: string) => aiFields.has(name) ? <span className="ai-tag" aria-label="filled by AI">AI</span> : null;
  const reading = ai.kind === "pending";

  const photoRow = (
    <div className="ai-photo">
      <div className="inline-form">
        <label className="f">Photo{m ? " (choose a file to replace it)" : ""}<input ref={photoRef} name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} /></label>
        <label className="f">Or image path<input name="image" defaultValue={m?.image ?? ""} placeholder="/img/machine.jpg or https://…" /></label>
      </div>
      {!m && ai.kind === "idle" && !fileNote && <p className="hint ai-hint">Choose a photo first: AI reads it and fills in the details. Nothing is saved until you press Add machine.</p>}
      {fileNote && <p className="hint" style={{ margin: 0 }}>{fileNote}</p>}
      {m && canFill && (
        <div><button type="button" className="btn btn-ghost btn-sm" onClick={onFillClick} disabled={reading}>{reading ? "Reading the photo…" : "Fill from photo"}</button></div>
      )}
      {reading && <p className="ai-status ai-pending" role="status"><span className="ai-spin" aria-hidden />Reading the photo…</p>}
      {ai.kind === "done" && (
        <div className="ai-status" role="status">
          <p><span className="ai-tag">AI</span> Filled {ai.filled} field{ai.filled === 1 ? "" : "s"} from the photo (confidence: {ai.confidence}). Check them, correct anything, then save.</p>
          {ai.notes && <p className="ai-notes">Double-check: {ai.notes}</p>}
        </div>
      )}
      {ai.kind === "error" && <p className="err" role="alert">{ai.error}</p>}
    </div>
  );

  return (
    <form ref={formRef} action={action} onChange={onEdit} className="panel" style={{ display: "grid", gap: ".8rem" }}>
      {m && <input type="hidden" name="id" value={m.id} />}
      {!m && photoRow}
      <div className="inline-form">
        <label className={ai$("name")}>Name{tag("name")}<input name="name" defaultValue={m?.name} required /></label>
        <label className={ai$("slug")}>Slug{tag("slug")}<input name="slug" defaultValue={m?.slug} pattern="[a-z0-9\-]+" title="Lowercase letters, numbers and dashes, e.g. jcb-telehandler" required /></label>
        <label className={ai$("category")}>Category{tag("category")}<select name="category" defaultValue={m?.category ?? "earth"}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className={ai$("categoryLabel")}>Category label{tag("categoryLabel")}<input name="categoryLabel" defaultValue={m?.categoryLabel} placeholder="Lifting · Telehandler" required /></label>
      </div>
      <div className="inline-form">
        <label className={ai$("dayRate")}>Rate (GH₵){tag("dayRate")}<input name="dayRate" type="number" min={0} defaultValue={m?.dayRate ?? 0} required /></label>
        <label className={ai$("rateUnit")}>Per{tag("rateUnit")}<select name="rateUnit" defaultValue={m?.rateUnit ?? "day"}><option value="day">day</option><option value="trip">trip</option></select></label>
        <label className={ai$("operatorRate")}>Operator / day (blank = included){tag("operatorRate")}<input name="operatorRate" type="number" min={0} defaultValue={m?.operatorRate ?? ""} /></label>
        <label className={ai$("fuelLPerDay")}>Diesel L / day (blank = metered){tag("fuelLPerDay")}<input name="fuelLPerDay" type="number" min={0} max={5000} defaultValue={m?.fuelLPerDay ?? ""} placeholder="e.g. 120" /></label>
        <label className="f">Sort order<input name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 99} /></label>
      </div>
      {m && photoRow}
      <label className={ai$("specs")}>Specs, one per line as Label: value{tag("specs")}<textarea name="specs" defaultValue={m?.specsText ?? ""} rows={4} placeholder={"Lift capacity: 4 T\nLift height: 17 m\nBest for: Blockwork, roofing"} /></label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      {state?.ok && <p className="ok" role="status">{state.ok}</p>}
      <div className="row-form">
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}><input type="checkbox" name="available" defaultChecked={m?.available ?? true} /> Available for hire</label>
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}><input type="checkbox" name="priceOnRequest" defaultChecked={m?.priceOnRequest ?? false} /> Price on request (hide the rate)</label>
        <label className={aiFields.has("selfDrive") ? "ai-check ai-filled" : undefined} style={{ display: "flex", gap: ".4rem", alignItems: "center" }} title="Tippers and the low bed drive to site: estimates skip the low bed transport line"><input type="checkbox" name="selfDrive" defaultChecked={m?.selfDrive ?? false} /> Drives itself to site (no low bed){tag("selfDrive")}</label>
        <button className="btn btn-accent btn-sm" type="submit" disabled={pending || reading}>{pending ? "Saving…" : reading ? "Reading photo…" : m ? "Save changes" : "Add machine"}</button>
      </div>
    </form>
  );
}
