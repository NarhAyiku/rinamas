// One-off, idempotent: each hire record used to have a single "internal note" (adminNote) that anyone could overwrite.
// Notes are QuoteNote rows now, each with its writer's name. This moves every remaining adminNote into a note row,
// crediting whoever the activity log says saved that exact text, then clears adminNote. Runs on every build; does nothing twice.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rows = await prisma.quoteRequest.findMany({
  where: { adminNote: { not: null } },
  select: { id: true, reference: true, adminNote: true, updatedAt: true },
});
let moved = 0;
for (const q of rows) {
  const body = q.adminNote?.trim();
  if (body) {
    const who = await prisma.activityLog.findFirst({
      where: { targetType: "quote", targetId: q.id, action: "quote.update", summary: { contains: `note "${body}"` } },
      orderBy: { createdAt: "desc" },
    });
    await prisma.quoteNote.create({
      data: {
        quoteId: q.id, body,
        staffId: who?.staffId ?? null,
        authorName: who?.actorName ?? "Desk (before notes had names)",
        createdAt: who?.createdAt ?? q.updatedAt,
      },
    });
    moved++;
  }
  await prisma.quoteRequest.update({ where: { id: q.id }, data: { adminNote: null, updatedAt: q.updatedAt } });
}
console.log(`backfill-notes: ${moved} note${moved === 1 ? "" : "s"} moved to the notes list`);
await prisma.$disconnect();
