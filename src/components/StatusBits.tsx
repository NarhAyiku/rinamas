import { ALL_STATUSES, STATUSES, STATUS_HINT, STATUS_LABEL, fmtDate } from "@/lib/format";
import { updateQuote } from "@/app/admin/actions";

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}><i aria-hidden="true" />{STATUS_LABEL[status] ?? status}</span>;
}

/** Hire progress, shared by the customer's reference page and the admin hire record. */
export function Timeline({ status, style, customer }: { status: string; style?: React.CSSProperties; customer?: boolean }) {
  const stepIdx = STATUSES.indexOf(status as (typeof STATUSES)[number]);
  return (
    <ol className="timeline" aria-label="Hire progress" style={style}>
      {STATUSES.map((s, i) => (
        <li key={s} className={i < stepIdx ? "done" : i === stepIdx ? "now" : ""}><b>{STATUS_LABEL[s]}</b><span>{STATUS_HINT[s]}</span></li>
      ))}
      {status === "lost" && <li className="lost"><b>{customer ? "Not going ahead" : "Lost"}</b><span>{customer ? "This request is closed. Send a new one any time." : STATUS_HINT.lost}</span></li>}
    </ol>
  );
}

/** Status + add-a-note form, shared by the request list and the hire record. A note is added under your name; it never replaces another. */
export function QuoteStatusForm({ id, status, className, style, notePlaceholder }: {
  id: string; status: string; className: string; style?: React.CSSProperties; notePlaceholder?: string;
}) {
  return (
    <form action={updateQuote} className={className} style={style}>
      <input type="hidden" name="id" value={id} />
      <label className="f">Status
        <select name="status" defaultValue={status}>{ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
      </label>
      <label className="f" style={{ flex: 1 }}>Add a note<input name="note" maxLength={1000} placeholder={notePlaceholder} /></label>
      <button className="btn btn-accent btn-sm" type="submit">Save</button>
    </form>
  );
}

/** "Ama Mensah, 20 Nov, 14:05": who wrote a desk note and when. */
export function NoteByline({ authorName, createdAt }: { authorName: string; createdAt: Date }) {
  return <span className="note-by"><b>{authorName}</b> <time>{fmtDate(createdAt)}</time></span>;
}
