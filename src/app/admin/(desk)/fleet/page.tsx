import { prisma } from "@/lib/db";
import { CATEGORIES, ghs, parseSpecs } from "@/lib/format";
import { deleteMachine, saveMachine, toggleAvailable } from "@/app/admin/actions";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function MachineForm({ m }: { m?: Awaited<ReturnType<typeof prisma.machine.findMany>>[number] }) {
  const specsText = m ? parseSpecs(m.specs).map(([k, v]) => `${k}: ${v}`).join("\n") : "";
  return (
    <form action={saveMachine} className="panel" style={{ display: "grid", gap: ".8rem" }}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="inline-form">
        <label className="f">Name<input name="name" defaultValue={m?.name} required /></label>
        <label className="f">Slug<input name="slug" defaultValue={m?.slug} pattern="[a-z0-9-]+" required /></label>
        <label className="f">Category<select name="category" defaultValue={m?.category ?? "earth"}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="f">Category label<input name="categoryLabel" defaultValue={m?.categoryLabel} placeholder="Earthmoving · Trenching" required /></label>
      </div>
      <div className="inline-form">
        <label className="f">Rate (GH₵)<input name="dayRate" type="number" min={0} defaultValue={m?.dayRate ?? 0} required /></label>
        <label className="f">Per<select name="rateUnit" defaultValue={m?.rateUnit ?? "day"}><option value="day">day</option><option value="trip">trip</option></select></label>
        <label className="f">Operator / day (blank = included)<input name="operatorRate" type="number" min={0} defaultValue={m?.operatorRate ?? ""} /></label>
        <label className="f">Sort order<input name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 99} /></label>
      </div>
      <div className="inline-form">
        <label className="f">Photo{m ? " (choose a file to replace it)" : ""}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label className="f">Or image path<input name="image" defaultValue={m?.image ?? ""} placeholder="/img/machine.jpg or https://…" /></label>
      </div>
      <label className="f">Specs, one per line as Label: value<textarea name="specs" defaultValue={specsText} rows={4} /></label>
      <div className="row-form">
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}><input type="checkbox" name="available" defaultChecked={m?.available ?? true} /> Available for hire</label>
        <button className="btn btn-accent btn-sm" type="submit">{m ? "Save changes" : "Add machine"}</button>
      </div>
    </form>
  );
}

export default async function FleetAdmin() {
  const machines = await prisma.machine.findMany({ orderBy: { sortOrder: "asc" } });
  const session = await getSession();
  const isSuper = session?.role === "superadmin";
  return (
    <>
      <div className="admin-top"><div><p className="eyebrow">Yard</p><h2>Fleet &amp; rates</h2></div></div>
      <p className="lede" style={{ marginBottom: "1.4rem" }}>Changes here show on the public site immediately. Day rates are machine only for 8 hours; week and month prices are computed from the day rate. Upload a photo for each machine (JPG, PNG or WebP, under 5 MB); the old photo is replaced.</p>
      <div style={{ display: "grid", gap: "1rem" }}>
        {machines.map((m) => (
          <details key={m.id} className="panel" style={{ padding: 0 }}>
            <summary style={{ cursor: "pointer", padding: "1rem 1.4rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <img src={m.image} alt="" width={72} height={54} style={{ objectFit: "cover", borderRadius: 4 }} />
              <b style={{ flex: 1 }}>{m.name}</b>
              <span className="pill pill-plain">{CATEGORIES[m.category] ?? m.category}</span>
              <span className="num" style={{ fontFamily: "var(--mono)" }}>{ghs(m.dayRate)} / {m.rateUnit}</span>
              <span className={`pill ${m.available ? "pill-confirmed" : "pill-closed"}`}><i aria-hidden="true" />{m.available ? "Available" : "On hire"}</span>
            </summary>
            <div style={{ padding: "0 1.4rem 1.4rem", display: "grid", gap: ".8rem" }}>
              <MachineForm m={m} />
              <div className="row-form">
                <form action={toggleAvailable}><input type="hidden" name="id" value={m.id} /><button className="btn btn-ghost btn-sm" type="submit">{m.available ? "Mark on hire" : "Mark available"}</button></form>
                {isSuper && <form action={deleteMachine}><input type="hidden" name="id" value={m.id} /><button className="btn btn-ghost btn-sm" type="submit" style={{ color: "var(--danger)" }}>Delete</button></form>}
              </div>
            </div>
          </details>
        ))}
      </div>
      <h3 style={{ margin: "2.4rem 0 1rem" }}>Add a machine</h3>
      <MachineForm />
    </>
  );
}
