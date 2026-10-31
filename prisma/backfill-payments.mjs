// One-off, idempotent: deposits used to be three columns on the hire record (depositAmount,
// depositPaidAt, depositMethod). Money now lives in Payment rows, so every record with a paid
// deposit and no payments yet gets one deposit Payment. Runs on every build; does nothing twice.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const METHODS = new Set(["momo", "bank", "cash", "cheque"]);

const rows = await prisma.quoteRequest.findMany({
  where: { depositPaidAt: { not: null }, depositAmount: { gt: 0 }, payments: { none: {} } },
  select: { id: true, reference: true, depositAmount: true, depositPaidAt: true, depositMethod: true },
});
for (const q of rows) {
  await prisma.payment.create({
    data: {
      quoteId: q.id, kind: "deposit", amount: q.depositAmount, paidAt: q.depositPaidAt,
      method: METHODS.has(q.depositMethod ?? "") ? q.depositMethod : "cash",
      note: "Moved from the old deposit fields", loggedBy: "system",
    },
  });
  await prisma.activityLog.create({ data: { actorName: "system", action: "payment.backfill", targetType: "quote", targetId: q.id, summary: `${q.reference}: deposit GH₵ ${q.depositAmount.toLocaleString("en-GH")} paid ${q.depositPaidAt} moved to payments` } });
}
console.log(`backfill-payments: ${rows.length} deposit${rows.length === 1 ? "" : "s"} moved to payments`);
await prisma.$disconnect();
