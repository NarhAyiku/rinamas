// One-off, idempotent: requests from before "handled by" existed have no handler. Credit each one to the first staff member
// who worked on it, by the same rule the desk uses now (status change, quote, hire details, money, hours; notes do not count),
// read from the activity log. A request that ever had a handler change logged (quote.owner) is left alone, so a deliberate
// "nobody" is never undone. Runs on every build; does nothing twice.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const WORK = ["quote.hire", "payment.add", "quote.final", "hourlog.add"];

const rows = await prisma.quoteRequest.findMany({ where: { ownerId: null }, select: { id: true, reference: true } });
let credited = 0;
for (const q of rows) {
  const logs = await prisma.activityLog.findMany({ where: { targetType: "quote", targetId: q.id }, orderBy: { createdAt: "asc" } });
  if (logs.some((l) => l.action === "quote.owner")) continue;
  const first = logs.find((l) => l.staffId && (WORK.includes(l.action) || (l.action === "quote.update" && /status /.test(l.summary))));
  if (!first) continue;
  const staff = await prisma.staff.findUnique({ where: { id: first.staffId } });
  if (!staff) continue;
  await prisma.quoteRequest.update({ where: { id: q.id }, data: { ownerId: staff.id, ownedAt: first.createdAt } });
  await prisma.activityLog.create({ data: { actorName: "system", action: "quote.owner", targetType: "quote", targetId: q.id, summary: `${q.reference}: ${staff.name} credited as handler from the history (first to work on it)` } });
  credited++;
}
console.log(`backfill-owners: ${credited} request${credited === 1 ? "" : "s"} credited to a handler`);
await prisma.$disconnect();
