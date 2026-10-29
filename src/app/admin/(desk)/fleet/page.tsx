import { prisma } from "@/lib/db";
import { CATEGORIES, ghs, parseSpecs } from "@/lib/format";
import { deleteMachine, toggleAvailable } from "@/app/admin/actions";
import { MachineForm, type MachineFormData } from "./MachineForm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof prisma.machine.findMany>>[number];
const toForm = (m: Row): MachineFormData => ({
  id: m.id, name: m.name, slug: m.slug, category: m.category, categoryLabel: m.categoryLabel, dayRate: m.dayRate, rateUnit: m.rateUnit,
  operatorRate: m.operatorRate, sortOrder: m.sortOrder, image: m.image, available: m.available, priceOnRequest: m.priceOnRequest,
  specsText: parseSpecs(m.specs).map(([k, v]) => `${k}: ${v}`).join("\n"),
});

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
              <span className="num" style={{ fontFamily: "var(--mono)" }}>{m.priceOnRequest ? "on request" : `${ghs(m.dayRate)} / ${m.rateUnit}`}</span>
              <span className={`pill ${m.available ? "pill-confirmed" : "pill-closed"}`}><i aria-hidden="true" />{m.available ? "Available" : "On hire"}</span>
            </summary>
            <div style={{ padding: "0 1.4rem 1.4rem", display: "grid", gap: ".8rem" }}>
              <MachineForm m={toForm(m)} />
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
