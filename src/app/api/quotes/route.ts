import { NextResponse } from "next/server";
import { createHireRequest } from "@/lib/hire-request";
import { clientIp, rateLimiter } from "@/lib/ratelimit";

// 10 requests per IP per 10 minutes.
const limited = rateLimiter(10, 10 * 60 * 1000);

export async function POST(req: Request) {
  if (limited(clientIp(req))) return NextResponse.json({ error: "Lots of requests from this connection just now. Please call or WhatsApp dispatch instead." }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const r = await createHireRequest(body, "form");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ id: r.id, reference: r.reference, estimateTotal: r.estimateTotal }, { status: 201 });
}
