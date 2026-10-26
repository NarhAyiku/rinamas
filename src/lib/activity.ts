import { prisma } from "./db";
import type { Session } from "./auth";

export async function logActivity(
  actor: Session | null,
  action: string,
  summary: string,
  target?: { type: "quote" | "machine" | "staff"; id: string },
) {
  await prisma.activityLog.create({
    data: {
      staffId: actor?.id ?? null,
      actorName: actor?.name ?? "system",
      action,
      summary,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
    },
  });
}
