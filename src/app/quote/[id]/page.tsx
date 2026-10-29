import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ghs, waLink } from "@/lib/format";
import { whatsappNumber } from "@/lib/contact";
import { Timeline } from "@/components/StatusBits";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote request received" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await prisma.quoteRequest.findUnique({ where: { id }, include: { hourLogs: true, zone: true } });
  if (!q) notFound();
  const hours = q.hourLogs.reduce((a, l) => a + l.hours, 0);
  const where = q.zone ? `Zone ${q.zone.name}, ${q.zone.label.charAt(0).toLowerCase() + q.zone.label.slice(1)}` : "distance to be confirmed";
  const estimateLine = q.estimateTotal != null ? `${ghs(q.estimateTotal)} indicative · ${where}${q.days ? ` · ${q.days} day${q.days === 1 ? "" : "s"}` : ""}` : null;

  const msg = [
    `Hello RINAMAS dispatch, following up on quote request ${q.reference}.`,
    `Machine: ${q.machineName}`,
    `Start: ${q.startDate} · Duration: ${q.duration}`,
    `Site: ${q.site}${q.zone ? ` (Zone ${q.zone.name})` : ""}`,
    `Operator: ${q.operator === "with" ? "With operator" : "Machine only"}`,
    `Fuel: ${q.fuel === "with" ? "With fuel from RINAMAS" : "Without fuel, we buy our own"}`,
    q.estimateTotal != null ? `Estimate: ${ghs(q.estimateTotal)} (indicative), ${q.zone ? `Zone ${q.zone.name}` : "zone to confirm"}` : null,
    `Name: ${q.name} · Phone: ${q.phone}`,
    q.notes ? `Notes: ${q.notes}` : null,
  ].filter(Boolean).join("\n");
  const wa = waLink(whatsappNumber(), msg);

  return (
    <>
      <Header />
      <section className="band">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">{q.status === "new" ? "Request received" : "Your hire"}</p>
          <h2 style={{ marginTop: ".5rem" }}>{q.status === "new" ? "Dispatch has your job" : q.status === "on_hire" ? "Your machine is on site" : q.status === "closed" ? "Hire complete" : q.status === "lost" ? "Request closed" : "In progress"}</h2>
          <p className="lede" style={{ marginTop: ".8rem" }}>Keep this page: it is your job&apos;s record with RINAMAS and updates as dispatch works it. We reply with a written quote within the working day, Mon to Sat. For a faster answer, send the details to dispatch on WhatsApp with one tap.</p>
          <Timeline status={q.status} style={{ marginTop: "1.4rem" }} />
          <div className="panel" style={{ marginTop: "1.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <span className="ref">{q.reference}</span>
              <CopyButton text={q.reference} className="btn btn-ghost btn-sm" />
            </div>
            <dl className="kv">
              <dt>Machine</dt><dd>{q.machineName}</dd>
              <dt>Start</dt><dd>{q.startDate} · {q.duration}</dd>
              <dt>Site</dt><dd>{q.site}{q.zone ? <span className="muted"> · Zone {q.zone.name}, {q.zone.label.charAt(0).toLowerCase() + q.zone.label.slice(1)}</span> : null}</dd>
              <dt>Operator</dt><dd>{q.operator === "with" ? "With operator" : "Machine only"}</dd>
              <dt>Fuel</dt><dd>{q.fuel === "with" ? "With fuel from RINAMAS" : "Without fuel, you buy your own"}</dd>
              {estimateLine && <><dt>Indicative estimate</dt><dd>{estimateLine}<br /><span className="muted" style={{ fontSize: ".85rem" }}>Worked out from the rate card when you sent the form. Dispatch confirms the figure in writing; that written rate is then fixed for your hire.</span></dd></>}
              <dt>Contact</dt><dd>{q.name} · {q.phone}</dd>
              {q.notes && <><dt>Notes</dt><dd>{q.notes}</dd></>}
              {q.quotedAmount ? <><dt>Quoted</dt><dd>{ghs(q.quotedAmount)}{q.depositAmount ? ` · deposit ${ghs(q.depositAmount)}${q.depositPaidAt ? ` received ${q.depositPaidAt}` : " to lock the date"}` : ""}</dd></> : null}
              {q.dispatchDate && <><dt>Dispatched</dt><dd>{q.dispatchDate}{q.dispatchMeter != null ? ` · meter ${q.dispatchMeter} h` : ""}</dd></>}
              {hours > 0 && <><dt>Hours logged</dt><dd>{hours} h over {q.hourLogs.length} day{q.hourLogs.length === 1 ? "" : "s"}</dd></>}
              {q.returnDate && <><dt>Returned</dt><dd>{q.returnDate}{q.returnMeter != null ? ` · meter ${q.returnMeter} h` : ""}</dd></>}
            </dl>
            <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginTop: "1.4rem" }}>
              <a className="btn btn-wa" href={wa} target="_blank" rel="noopener">Send to dispatch on WhatsApp</a>
              <a className="btn btn-ghost" href="/">Back to the site</a>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
