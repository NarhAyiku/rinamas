"use client";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import type { AssistantTools } from "@/lib/assistant";
import { waLink } from "@/lib/format";
import { DISPATCH_PHONE, WA_GREETING } from "@/lib/contact";
import { track } from "@/lib/analytics";

type ChatMessage = UIMessage<unknown, UIDataTypes, InferUITools<AssistantTools>>;
type HireInput = InferUITools<AssistantTools>["submitHireRequest"]["input"];

const STARTERS = ["Excavator for 2 weeks in Kumasi?", "Do you supply operators?", "How does delivery work?", "I need a backhoe next Monday"];

const fmtDate = (d: string) => { const t = new Date(d + "T00:00:00"); return isNaN(+t) ? d : t.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" }); };

/**
 * "Ask RINAMAS": the chat button and panel on the public pages. Answers come from /api/chat (Groq). When the assistant
 * fills in a hire request, the customer sees it here and taps "Send request"; only then is it filed with dispatch.
 */
export function ChatWidget({ machines, wa }: { machines: { slug: string; name: string }[]; wa: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const counted = useRef(new Set<string>());
  const { messages, sendMessage, status, error, addToolApprovalResponse, clearError } = useChat<ChatMessage>({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const busy = status === "submitted" || status === "streaming";
  const machineName = (slug: string) => (slug === "other" ? "Something else (see notes)" : machines.find((m) => m.slug === slug)?.name ?? slug);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("chat-open");
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("chat-open"); };
  }, [open]);

  // Keep the newest message in view, and count each request the chat files once.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
    for (const m of messages) for (const p of m.parts) {
      if (p.type === "tool-submitHireRequest" && p.state === "output-available" && p.output.ok && !counted.current.has(p.toolCallId)) {
        counted.current.add(p.toolCallId);
        track("quote_submitted", { source: "chat", machine: machineName(p.input.machineSlug), zone: p.input.zone, days: p.input.days, path: location.pathname });
      }
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  function show() { setOpen(true); track("chat_opened", { path: location.pathname }); }
  function close() { setOpen(false); btn.current?.focus(); }
  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    if (error) clearError();
    sendMessage({ text: t });
    setInput("");
    track("chat_message", { n: messages.filter((m) => m.role === "user").length + 1 });
  }

  return (
    <>
      <button ref={btn} type="button" className="chat-fab" aria-expanded={open} aria-controls="chat-panel" onClick={() => (open ? close() : show())}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span>Ask RINAMAS</span>
      </button>

      <section id="chat-panel" className="chat-panel" role="dialog" aria-label="Ask RINAMAS" hidden={!open}>
        <header className="chat-head">
          <div><b>Ask RINAMAS</b><span>AI assistant · answers from today&apos;s fleet</span></div>
          <button type="button" className="mdlg-x" onClick={close} aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="chat-log" ref={list} aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-hello">
              <p>Hello! Ask about any machine, price, delivery to your site, or send a hire request right here.</p>
              <div className="chat-starters">{STARTERS.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}</div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-msg chat-${m.role}`}>
              {m.parts.map((p, i) => {
                if (p.type === "text") return p.text ? <p key={i}>{p.text}</p> : null;
                if (p.type === "tool-estimateHire" && (p.state === "input-streaming" || p.state === "input-available")) return <p key={i} className="chat-note">Working out the price…</p>;
                if (p.type !== "tool-submitHireRequest") return null;
                if (p.state === "approval-requested") return <HireCard key={i} input={p.input} machine={machineName(p.input.machineSlug)}>
                  <div className="chat-actions">
                    <button type="button" className="btn btn-accent btn-sm" onClick={() => addToolApprovalResponse({ id: p.approval.id, approved: true })}>Send request</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => addToolApprovalResponse({ id: p.approval.id, approved: false, reason: "The customer wants to change something" })}>Change something</button>
                  </div>
                </HireCard>;
                if (p.state === "approval-responded") return <p key={i} className="chat-note">{p.approval.approved ? "Sending to dispatch…" : "Not sent."}</p>;
                if (p.state === "output-available" && p.output.ok) return <div key={i} className="chat-done">
                  <b>Request {p.output.reference} sent</b>
                  <span>Dispatch will call or WhatsApp you with a written quote the same working day.</span>
                  <a href={waLink(wa, `Hello RINAMAS dispatch, following up on my chat request ${p.output.reference}.`)} target="_blank" rel="noopener">Follow up on WhatsApp →</a>
                </div>;
                if (p.state === "output-available" && !p.output.ok) return <p key={i} className="chat-note">Couldn&apos;t send that: {p.output.error}</p>;
                if (p.state === "output-error") return <p key={i} className="chat-note">Couldn&apos;t send that. Please call {DISPATCH_PHONE.display}.</p>;
                return null;
              })}
            </div>
          ))}
          {status === "submitted" && <div className="chat-msg chat-assistant"><p className="chat-typing" aria-label="Typing"><i /><i /><i /></p></div>}
          {error && <p className="chat-note chat-err">Sorry, the assistant isn&apos;t answering right now. Please call or <a href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp {DISPATCH_PHONE.display}</a>.</p>}
        </div>

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea ref={field} rows={1} value={input} maxLength={1500} placeholder="Type your question…" aria-label="Your message"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
          <button type="submit" className="btn btn-accent btn-sm" disabled={busy || !input.trim()}>Send</button>
        </form>
        <p className="chat-foot">AI answers can be wrong; your written quote is final. Rather talk? <a href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp dispatch</a></p>
      </section>
    </>
  );
}

function HireCard({ input, machine, children }: { input: HireInput; machine: string; children: React.ReactNode }) {
  const rows: [string, string][] = [
    ["Machine", machine], ["Start", fmtDate(input.startDate)], ["Days", String(input.days)], ["Site", input.site + (input.zone ? ` (Zone ${input.zone})` : "")],
    ["Operator", input.operator === "with" ? "With our operator" : "Machine only"], ["Fuel", input.fuel === "with" ? "With fuel from RINAMAS" : "We buy our own"],
    ["Name", input.name], ["Phone", input.phone], ...(input.notes ? [["Notes", input.notes] as [string, string]] : []),
  ];
  return (
    <div className="chat-card">
      <b>Check your request</b>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {children}
    </div>
  );
}
