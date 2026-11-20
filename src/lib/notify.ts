// Desk alerts by email (Resend). Two kinds: a request is handed to someone, and requests have waited too long with
// nobody on them. Sending never breaks a desk action: without RESEND_API_KEY nothing is sent and the desk banners still
// show; a failed send is logged and reported back, not thrown.
import { prisma } from "./db";
import { logActivity } from "./activity";
import type { Session } from "./auth";

/**
 * ON HOLD (owner's decision, 20 Nov 2026): no alert emails are sent and the email settings are hidden.
 * To switch back on: set this to true, install Resend on the Vercel project (RESEND_API_KEY), verify rinamas.com in
 * Resend and set ALERT_FROM, set CRON_SECRET in Vercel and GitHub, and uncomment the schedule in
 * .github/workflows/desk-alerts.yml. The desk banner and "Handed to you by" labels do not depend on this.
 */
export const EMAIL_ALERTS_ENABLED = false;

export const WAIT_HOURS = 2;
/** Alerts for waiting requests go out between these Accra hours (Accra is UTC+0 all year). Overnight requests alert from 07:00. */
export const ALERT_FROM_HOUR = 7, ALERT_TO_HOUR = 20;
const OPEN = ["new", "quoted", "confirmed", "on_hire"];
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://rinamas.com").replace(/\/$/, "");

export type SendResult = { sent: true; id?: string } | { sent: false; reason: string };

export function emailReady() { return EMAIL_ALERTS_ENABLED && !!process.env.RESEND_API_KEY; }

export async function sendEmail(to: string[], subject: string, text: string, html: string): Promise<SendResult> {
  if (!EMAIL_ALERTS_ENABLED) return { sent: false, reason: "email alerts are on hold" };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "email not set up (RESEND_API_KEY missing)" };
  if (!to.length) return { sent: false, reason: "nobody has an alert email" };
  const from = process.env.ALERT_FROM || "RINAMAS Desk <onboarding@resend.dev>";
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    const body = await res.json().catch(() => ({})) as { id?: string; message?: string };
    if (!res.ok) { console.error("alert email failed", res.status, body.message); return { sent: false, reason: `email service said ${res.status}${body.message ? `: ${body.message}` : ""}` }; }
    return { sent: true, id: body.id };
  } catch (e) {
    console.error("alert email failed", e);
    return { sent: false, reason: "could not reach the email service" };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const wrap = (inner: string) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b1814;max-width:560px">${inner}<p style="color:#7a7266;font-size:12px;margin-top:24px">RINAMAS dispatch desk. Turn these emails off under My account.</p></div>`;
const ago = (d: Date) => { const m = Math.round((Date.now() - d.getTime()) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim(); };

/** Email the person a request was just handed to. Called after the handover is saved and logged. */
export async function notifyHandover(quoteId: string, by: Session, toStaffId: string): Promise<SendResult> {
  const [q, to] = await Promise.all([
    prisma.quoteRequest.findUnique({ where: { id: quoteId }, include: { deskNotes: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.staff.findUnique({ where: { id: toStaffId } }),
  ]);
  if (!q || !to) return { sent: false, reason: "request or person not found" };
  if (!to.active || !to.alerts || !to.email) return { sent: false, reason: `${to.name} has no alert email or turned alerts off` };
  const link = `${siteUrl()}/admin/requests/${q.id}`;
  const note = q.deskNotes[0];
  const subject = `${by.name} handed you ${q.reference}: ${q.machineName}`;
  const text = [
    `${by.name} handed you ${q.reference}.`, "",
    `Customer: ${q.name}, ${q.phone}`, `Machine: ${q.machineName}`, `Dates: ${q.startDate}, ${q.duration}`, `Site: ${q.site}`,
    note ? `Latest note (${note.authorName}): ${note.body}` : "", "", `Open it: ${link}`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const html = wrap(`<p><b>${esc(by.name)}</b> handed you <b>${esc(q.reference)}</b>.</p>
<table style="border-collapse:collapse;font-size:14px">
<tr><td style="padding:2px 12px 2px 0;color:#7a7266">Customer</td><td>${esc(q.name)}, <a href="tel:${esc(q.phone)}">${esc(q.phone)}</a></td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#7a7266">Machine</td><td>${esc(q.machineName)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#7a7266">Dates</td><td>${esc(q.startDate)}, ${esc(q.duration)}</td></tr>
<tr><td style="padding:2px 12px 2px 0;color:#7a7266">Site</td><td>${esc(q.site)}</td></tr>
${note ? `<tr><td style="padding:2px 12px 2px 0;color:#7a7266">Latest note</td><td>${esc(note.authorName)}: ${esc(note.body)}</td></tr>` : ""}
</table>
<p><a href="${link}" style="display:inline-block;background:#F5B800;color:#1b1814;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Open ${esc(q.reference)}</a></p>`);
  return sendEmail([to.email], subject, text, html);
}

/** Open requests nobody has taken, waiting longer than WAIT_HOURS. */
export function waitingWhere(now = new Date()) {
  return { ownerId: null, status: { in: OPEN }, createdAt: { lte: new Date(now.getTime() - WAIT_HOURS * 3_600_000) } };
}

export function inAlertHours(now = new Date()) {
  const h = now.getUTCHours();
  return h >= ALERT_FROM_HOUR && h < ALERT_TO_HOUR;
}

/**
 * Alert staff, once per request, about requests nobody has taken after WAIT_HOURS. One email lists them all.
 * Safe to call often (cron, desk loads): each request is claimed for alerting before sending, so two runs never double-send.
 */
export async function alertWaiting(now = new Date()) {
  if (!EMAIL_ALERTS_ENABLED) return { checked: 0, alerted: 0, result: { sent: false, reason: "email alerts are on hold" } as SendResult };
  if (!inAlertHours(now)) return { checked: 0, alerted: 0, result: { sent: false, reason: "outside alert hours" } as SendResult };
  const due = await prisma.quoteRequest.findMany({ where: { ...waitingWhere(now), waitAlertAt: null }, orderBy: { createdAt: "asc" } });
  if (!due.length) return { checked: 0, alerted: 0, result: { sent: false, reason: "nothing waiting" } as SendResult };
  if (!emailReady()) return { checked: due.length, alerted: 0, result: { sent: false, reason: "email not set up (RESEND_API_KEY missing)" } as SendResult };
  // claim: only rows this run flips from null get alerted
  const claimed = [];
  for (const q of due) {
    const r = await prisma.quoteRequest.updateMany({ where: { id: q.id, waitAlertAt: null, ownerId: null }, data: { waitAlertAt: now } });
    if (r.count) claimed.push(q);
  }
  if (!claimed.length) return { checked: due.length, alerted: 0, result: { sent: false, reason: "already alerted" } as SendResult };
  const people = await prisma.staff.findMany({ where: { active: true, alerts: true, email: { not: null } }, select: { email: true, name: true } });
  const to = people.map((p) => p.email!).filter(Boolean);
  const base = siteUrl();
  const one = claimed.length === 1;
  const subject = one ? `Nobody has taken ${claimed[0].reference} after ${ago(claimed[0].createdAt)}` : `${claimed.length} requests waiting with nobody on them`;
  const lines = claimed.map((q) => `${q.reference} · ${q.machineName} · ${q.name} ${q.phone} · ${q.site} · waiting ${ago(q.createdAt)}\n${base}/admin/requests/${q.id}`);
  const text = `${one ? "This request has" : "These requests have"} waited over ${WAIT_HOURS} hours and nobody on the desk has taken ${one ? "it" : "them"}. The customer is waiting for a call.\n\n${lines.join("\n\n")}\n\nAll waiting requests: ${base}/admin?who=none`;
  const html = wrap(`<p>${one ? "This request has" : "These requests have"} waited over ${WAIT_HOURS} hours and nobody on the desk has taken ${one ? "it" : "them"}. The customer is waiting for a call.</p>
<ul style="padding-left:18px">${claimed.map((q) => `<li style="margin-bottom:8px"><a href="${base}/admin/requests/${q.id}"><b>${esc(q.reference)}</b></a> · ${esc(q.machineName)}<br>${esc(q.name)}, <a href="tel:${esc(q.phone)}">${esc(q.phone)}</a> · ${esc(q.site)} · waiting ${ago(q.createdAt)}</li>`).join("")}</ul>
<p><a href="${base}/admin?who=none" style="display:inline-block;background:#F5B800;color:#1b1814;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Take one now</a></p>`);
  const result = await sendEmail(to, subject, text, html);
  if (!result.sent) {
    // release the claim so the next run tries again; the failure goes to the server log, not the job history every 15 minutes
    await prisma.quoteRequest.updateMany({ where: { id: { in: claimed.map((q) => q.id) }, waitAlertAt: now }, data: { waitAlertAt: null } });
    console.error("waiting-request alert not sent:", result.reason);
  } else {
    for (const q of claimed) {
      await logActivity(null, "quote.alert", `${q.reference}: waited ${ago(q.createdAt)} with nobody on it; alert emailed to ${people.map((p) => p.name).join(", ")}`, { type: "quote", id: q.id });
    }
  }
  return { checked: due.length, alerted: result.sent ? claimed.length : 0, result };
}
