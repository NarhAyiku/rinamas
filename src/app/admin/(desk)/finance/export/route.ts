import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { PAYMENT_KINDS, PAYMENT_METHODS } from "@/lib/settle";

export const dynamic = "force-dynamic";

const cell = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Payments as CSV for the accountant: one month (?month=YYYY-MM) or everything (?month=all). Super admin only. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "superadmin") return new Response("Super admin only", { status: 403 });
  const month = new URL(req.url).searchParams.get("month") ?? "all";
  const where = /^\d{4}-\d{2}$/.test(month) ? { paidAt: { startsWith: month } } : {};
  const rows = await prisma.payment.findMany({ where, include: { quote: true }, orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] });
  const head = ["Paid on", "Hire ref", "Customer", "Phone", "Machine", "Payment", "Method", "Reference", "Amount GHS", "Note", "Logged by"];
  const body = rows.map((p) => [
    p.paidAt, p.quote.reference, p.quote.name, p.quote.phone, p.quote.machineName,
    PAYMENT_KINDS[p.kind as keyof typeof PAYMENT_KINDS] ?? p.kind, PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method,
    p.reference, p.kind === "refund" ? -p.amount : p.amount, p.note, p.loggedBy,
  ].map(cell).join(","));
  await logActivity(s, "payment.export", `Downloaded ${rows.length} payment${rows.length === 1 ? "" : "s"} (${month === "all" ? "all time" : month}) as CSV`);
  return new Response([head.join(","), ...body].join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rinamas-payments-${month}.csv"` },
  });
}
