// Checks for requests nobody has taken and emails staff (see src/lib/notify.ts). Called every 15 minutes by
// .github/workflows/desk-alerts.yml (Vercel Hobby cron only runs daily) with "Authorization: Bearer $CRON_SECRET".
import { timingSafeEqual } from "node:crypto";
import { EMAIL_ALERTS_ENABLED, alertWaiting } from "@/lib/notify";

export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!EMAIL_ALERTS_ENABLED) return Response.json({ error: "email alerts are on hold" }, { status: 503 });
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const r = await alertWaiting();
  return Response.json({ ok: true, ...r });
}
