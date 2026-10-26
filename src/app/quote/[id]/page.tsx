import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { waLink } from "@/lib/format";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote request received" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await prisma.quoteRequest.findUnique({ where: { id } });
  if (!q) notFound();

  const msg = [
    `Hello RINAMAS dispatch, following up on quote request ${q.reference}.`,
    `Machine: ${q.machineName}`,
    `Start: ${q.startDate} · Duration: ${q.duration}`,
    `Site: ${q.site}`,
    `Operator: ${q.operator === "with" ? "With operator" : "Machine only"}`,
    `Fuel: ${q.fuel === "with" ? "With fuel from RINAMAS" : "Without fuel, we buy our own"}`,
    `Name: ${q.name} · Phone: ${q.phone}`,
    q.notes ? `Notes: ${q.notes}` : null,
  ].filter(Boolean).join("\n");
  const wa = waLink(process.env.WHATSAPP_NUMBER ?? "233243518749", msg);

  return (
    <>
      <Header />
      <section className="band">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Request received</p>
          <h2 style={{ marginTop: ".5rem" }}>Dispatch has your job</h2>
          <p className="lede" style={{ marginTop: ".8rem" }}>Your reference is below. We reply with a written quote within the working day, Mon to Sat. For a faster answer, send the same details to dispatch on WhatsApp with one tap.</p>
          <div className="panel" style={{ marginTop: "1.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <span className="ref">{q.reference}</span>
              <CopyButton text={q.reference} className="btn btn-ghost btn-sm" />
            </div>
            <dl className="kv">
              <dt>Machine</dt><dd>{q.machineName}</dd>
              <dt>Start</dt><dd>{q.startDate} · {q.duration}</dd>
              <dt>Site</dt><dd>{q.site}</dd>
              <dt>Operator</dt><dd>{q.operator === "with" ? "With operator" : "Machine only"}</dd>
              <dt>Fuel</dt><dd>{q.fuel === "with" ? "With fuel from RINAMAS" : "Without fuel, you buy your own"}</dd>
              <dt>Contact</dt><dd>{q.name} · {q.phone}</dd>
              {q.notes && <><dt>Notes</dt><dd>{q.notes}</dd></>}
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
