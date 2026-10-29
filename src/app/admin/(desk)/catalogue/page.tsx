import { prisma } from "@/lib/db";
import { requireSuper } from "@/lib/auth";
import { CATALOGUE, CHANGE_LABEL, catalogueDiff, hasCustomPhoto, type CatalogueChange } from "@/data/catalogue";
import { catalogueAdd, catalogueApplyAll, catalogueRemove, catalogueRestore, catalogueUpdate } from "@/app/admin/actions";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";

type DbRow = Awaited<ReturnType<typeof loadDb>>[number];
const loadDb = () => prisma.machine.findMany({ include: { _count: { select: { quotes: true } } }, orderBy: { sortOrder: "asc" } });

const Thumb = ({ src }: { src: string }) => <img src={src} alt="" width={64} height={43} style={{ objectFit: "cover", borderRadius: 4, display: "block" }} />;

function Change({ ch }: { ch: CatalogueChange }) {
  if (ch.field === "specs") return <li><b>{CHANGE_LABEL.specs}</b> rewritten</li>;
  return <li><b>{CHANGE_LABEL[ch.field]}</b> <s className="muted">{ch.from}</s> → {ch.to}</li>;
}

export default async function CataloguePage() {
  await requireSuper();
  const db = await loadDb();
  const bySlug = new Map<string, DbRow>(db.map((m) => [m.slug, m]));

  const rows = CATALOGUE.map((c) => {
    const m = bySlug.get(c.slug);
    const changes = m ? catalogueDiff(c, m) : [];
    const kind: "add" | "update" | "same" = !m ? "add" : changes.length ? "update" : "same";
    return { c, m, changes, kind };
  });
  const extras = db.filter((m) => !CATALOGUE.some((c) => c.slug === m.slug));
  const adds = rows.filter((r) => r.kind === "add").length;
  const updates = rows.filter((r) => r.kind === "update").length;

  return (
    <>
      <div className="admin-top">
        <div><p className="eyebrow">Management</p><h2>Catalogue sync</h2></div>
        {/* Always rendered, so its result message survives the refresh that follows a successful apply. */}
        <SyncButton action={catalogueApplyAll} disabled={adds + updates === 0} pendingLabel="Applying…" className="btn btn-accent btn-sm"
          label={adds + updates ? `Apply all: ${adds} add${adds === 1 ? "" : "s"}, ${updates} update${updates === 1 ? "" : "s"}` : "Everything up to date"} />
      </div>
      <p className="lede" style={{ marginBottom: "1.4rem" }}>
        The catalogue in the code is the master list of machine names, categories, specs, photos and order. This page compares it with the yard database and applies the
        differences one row at a time, so nobody retypes machine details by hand. Day rates, operator rates, availability and price-on-request are set on the Fleet page
        and are never touched from here. Photos uploaded by staff are kept.
      </p>

      <div className="tablewrap">
        <table className="compact catalogue">
          <thead><tr><th>Photo</th><th>Slug</th><th>Catalogue name</th><th>Status</th><th>Difference</th><th>Quotes</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ c, m, changes, kind }) => (
              <tr key={c.slug}>
                <td><Thumb src={m?.image ?? c.image} /></td>
                <td className="num">{c.slug}</td>
                <td><b>{c.name}</b><br /><span className="muted" style={{ fontSize: ".8rem" }}>{c.categoryLabel}</span></td>
                <td>
                  {kind === "add" && <span className="pill pill-new"><i aria-hidden="true" />Add</span>}
                  {kind === "update" && <span className="pill pill-quoted"><i aria-hidden="true" />Update</span>}
                  {kind === "same" && <span className="pill pill-confirmed"><i aria-hidden="true" />Up to date</span>}
                </td>
                <td>
                  {kind === "add" && <span className="muted">Not on the yard yet</span>}
                  {changes.length > 0 && <ul className="diff">{changes.map((ch) => <Change key={ch.field} ch={ch} />)}</ul>}
                  {m && hasCustomPhoto(m) && <span className="chip-s">custom photo, kept</span>}
                  {kind === "same" && !(m && hasCustomPhoto(m)) && <span className="muted">—</span>}
                </td>
                <td className="num">{m ? m._count.quotes : "—"}</td>
                <td>
                  {kind === "add" && <SyncButton action={catalogueAdd} fields={{ slug: c.slug }} label="Add" className="btn btn-accent btn-sm" />}
                  {kind === "update" && <SyncButton action={catalogueUpdate} fields={{ slug: c.slug }} label="Update" />}
                </td>
              </tr>
            ))}
            {extras.map((m) => (
              <tr key={m.slug}>
                <td><Thumb src={m.image} /></td>
                <td className="num">{m.slug}</td>
                <td><b>{m.name}</b><br /><span className="muted" style={{ fontSize: ".8rem" }}>Not in the catalogue</span></td>
                <td>
                  {m.hidden ? <span className="pill pill-closed"><i aria-hidden="true" />Hidden</span>
                    : m._count.quotes === 0 ? <span className="pill pill-lost"><i aria-hidden="true" />Remove</span>
                    : <span className="pill pill-on_hire"><i aria-hidden="true" />Retire</span>}
                </td>
                <td>
                  {m.hidden ? <span className="muted">Hidden from the site; hire records kept</span>
                    : m._count.quotes === 0 ? <span className="muted">No hire records, safe to delete</span>
                    : <span className="muted">Has hire records, so it is hidden rather than deleted</span>}
                </td>
                <td className="num">{m._count.quotes}</td>
                <td>
                  {m.hidden
                    ? <SyncButton action={catalogueRestore} fields={{ id: m.id }} label="Restore" />
                    : <SyncButton action={catalogueRemove} fields={{ id: m.id }} label={m._count.quotes === 0 ? "Remove" : "Retire"} className="btn btn-ghost btn-sm danger"
                        confirm={m._count.quotes === 0 ? `Delete ${m.name} from the yard? It has no hire records.` : `Hide ${m.name} from the public site? Its ${m._count.quotes} hire record(s) stay.`} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">“Apply all” adds and updates only; removing or retiring a machine is always a single, confirmed click. The public site, the Fleet page and this page refresh after every action.</p>
    </>
  );
}
