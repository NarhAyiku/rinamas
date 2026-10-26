import { ALL_STATUSES, STATUSES, STATUS_HINT, STATUS_LABEL } from "@/lib/format";
import { updateQuote } from "@/app/admin/actions";

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}><i aria-hidden="true" />{STATUS_LABEL[status] ?? status}</span>;
}

/** Hire progress, shared by the customer's reference page and the admin hire record. */
export function Timeline({ status, style }: { status: string; style?: React.CSSProperties }) {
  const stepIdx = STATUSES.indexOf(status as (typeof STATUSES)[number]);
  return (
    <ol className="timeline" aria-label="Hire progress" style={style}>
      {STATUSES.map((s, i) => (
        <li key={s} className={i < stepIdx ? "done" : i === stepIdx ? "now" : ""}><b>{STATUS_LABEL[s]}</b><span>{STATUS_HINT[s]}</span></li>
      ))}
      {status === "lost" && <li className="lost"><b>Lost</b><span>{STATUS_HINT.lost}</span></li>}
    </ol>
  );
}

/** Status + internal note form, shared by the request list and the hire record. */
export function QuoteStatusForm({ id, status, adminNote, className, style, notePlaceholder }: {
  id: string; status: string; adminNote: string | null; className: string; style?: React.CSSProperties; notePlaceholder?: string;
}) {
  return (
    <form action={updateQuote} className={className} style={style}>
      <input type="hidden" name="id" value={id} />
      <label className="f">Status
        <select name="status" defaultValue={status}>{ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
      </label>
      <label className="f" style={{ flex: 1 }}>Internal note<input name="adminNote" defaultValue={adminNote ?? ""} placeholder={notePlaceholder} /></label>
      <button className="btn btn-accent btn-sm" type="submit">Save</button>
    </form>
  );
}
