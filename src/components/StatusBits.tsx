import { STATUS_LABEL } from "@/lib/format";

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}><i aria-hidden="true" />{STATUS_LABEL[status] ?? status}</span>;
}
