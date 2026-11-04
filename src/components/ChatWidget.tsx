"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import type { AssistantTools } from "@/lib/assistant";
import { waLink } from "@/lib/format";
import { DISPATCH_PHONE, WA_GREETING } from "@/lib/contact";
import { track } from "@/lib/analytics";
import { CHAT_EVENT } from "@/lib/chat-event";

type ChatMessage = UIMessage<unknown, UIDataTypes, InferUITools<AssistantTools>>;
type HireInput = InferUITools<AssistantTools>["submitHireRequest"]["input"];

const STARTERS = ["Excavator for 2 weeks in Kumasi?", "Do you supply operators?", "How does delivery work?", "I need a backhoe next Monday"];

/** House style for replies, whatever the model writes: no en or em dashes ("20–22" → "20 to 22", " – " → ", "),
 *  no heading marks, and **bold** shown as bold rather than asterisks. */
const tidy = (t: string) => t
  .replace(/^#+\s*/gm, "")
  .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
  .replace(/\s*[–—]\s*/g, ", ")
  .split(/\*\*(.+?)\*\*/g).map((s, i) => (i % 2 ? <b key={i}>{s}</b> : s));

const fmtDate = (d: string) => { const t = new Date(d + "T00:00:00"); return isNaN(+t) ? d : t.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" }); };

const CHAT_ICON = <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

/**
 * "Ask RINAMAS": the chat button and panel on the public pages. Answers come from /api/chat (Groq). When the assistant
 * fills in a hire request, the customer sees it here and taps "Send request"; only then is it filed with dispatch.
 * On phones the panel is a full-screen sheet sized to the visible viewport, so the keyboard never hides the input, and
 * opening it pushes a history entry so the back button closes it. The sticky bar and phone menu open it via openChat().
 */
export function ChatWidget({ machines, wa }: { machines: { slug: string; name: string }[]; wa: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const atBottom = useRef(true);
  const counted = useRef(new Set<string>());
  const { messages, sendMessage, status, error, addToolApprovalResponse, clearError } = useChat<ChatMessage>({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const waiting = status === "submitted" || (status === "streaming" && !(last?.role === "assistant" && last.parts.some((p) => (p.type === "text" && p.text) || p.type.startsWith("tool-"))));
  const machineName = (slug: string) => (slug === "other" ? "Something else (see notes)" : machines.find((m) => m.slug === slug)?.name ?? slug);

  const show = useCallback(() => {
    setOpen(true);
    if (!pushed.current) { history.pushState(history.state, ""); pushed.current = true; }
    track("chat_opened", { path: location.pathname });
  }, []);
  // Close through history when we added an entry, so back and the close button behave the same.
  const close = useCallback(() => {
    if (pushed.current) history.back();
    else setOpen(false);
  }, []);

  useEffect(() => {
    document.body.classList.add("has-chat");
    const onPop = () => { if (pushed.current) { pushed.current = false; setOpen(false); btn.current?.focus({ preventScroll: true }); } };
    window.addEventListener(CHAT_EVENT, show);
    window.addEventListener("popstate", onPop);
    return () => { document.body.classList.remove("has-chat"); window.removeEventListener(CHAT_EVENT, show); window.removeEventListener("popstate", onPop); };
  }, [show]);

  useEffect(() => {
    if (!open) return;
    // Keyboards on phones would open straight over the starters, so only desktop gets the cursor in the box.
    if (matchMedia("(pointer:fine)").matches) field.current?.focus(); else panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    // Fit the sheet to the part of the screen the keyboard leaves visible (iOS doesn't shrink fixed layers itself).
    const vv = window.visualViewport;
    const fit = () => { if (vv && panel.current) { panel.current.style.setProperty("--vvh", `${vv.height}px`); panel.current.style.setProperty("--vvt", `${vv.offsetTop}px`); } };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    window.addEventListener("keydown", onKey);
    document.body.classList.add("chat-open");
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("chat-open");
    };
  }, [open, close]);

  // Keep the newest message in view unless the visitor has scrolled up to read, and count each filed request once.
  useEffect(() => {
    if (atBottom.current) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
    for (const m of messages) for (const p of m.parts) {
      if (p.type === "tool-submitHireRequest" && p.state === "output-available" && p.output.ok && !counted.current.has(p.toolCallId)) {
        counted.current.add(p.toolCallId);
        track("quote_submitted", { source: "chat", machine: machineName(p.input.machineSlug), zone: p.input.zone, days: p.input.days, path: location.pathname });
      }
    }
  }, [messages, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Grow the box with what's typed (up to the CSS max-height); iOS Safari has no field-sizing.
  useLayoutEffect(() => {
    const t = field.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight + t.offsetHeight - t.clientHeight}px`;
  }, [input]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    if (error) clearError();
    atBottom.current = true;
    sendMessage({ text: t });
    setInput("");
    track("chat_message", { n: messages.filter((m) => m.role === "user").length + 1 });
  }

  return (
    <>
      <button ref={btn} type="button" className="chat-fab" aria-expanded={open} aria-controls="chat-panel" aria-label="Ask RINAMAS" onClick={() => (open ? close() : show())}>
        {CHAT_ICON}
        <span>Ask RINAMAS</span>
      </button>

      <section id="chat-panel" ref={panel} className={`chat-panel${open ? " open" : ""}`} role="dialog" aria-label="Ask RINAMAS" tabIndex={-1} inert={!open}>
        <header className="chat-head">
          <img src="/brand/rinamas-badge.svg" alt="" width={36} height={32} />
          <div><b>Ask RINAMAS</b><span>Machines, prices and bookings</span></div>
          <a className="chat-head-wa" href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener" aria-label="WhatsApp dispatch">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2m0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2m4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3" /></svg>
          </a>
          <button type="button" className="mdlg-x" onClick={close} aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="chat-log" ref={list} aria-live="polite" onScroll={(e) => { const l = e.currentTarget; atBottom.current = l.scrollHeight - l.scrollTop - l.clientHeight < 80; }}>
          <div className="chat-msg chat-assistant"><p>Ask about any machine, price or delivery to your site, or book a machine right here.</p></div>
          {messages.map((m) => (
            <div key={m.id} className={`chat-msg chat-${m.role}`}>
              {m.parts.map((p, i) => {
                if (p.type === "text") return p.text ? <p key={i}>{m.role === "assistant" ? tidy(p.text) : p.text}</p> : null;
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
          {waiting && <div className="chat-msg chat-assistant"><p className="chat-typing" aria-label="Typing"><i /><i /><i /></p></div>}
          {error && <p className="chat-note chat-err">Sorry, the assistant isn&apos;t answering right now. Please call or <a href={waLink(wa, WA_GREETING)} target="_blank" rel="noopener">WhatsApp {DISPATCH_PHONE.display}</a>.</p>}
        </div>

        {messages.length === 0 && (
          <div className="chat-starters" role="group" aria-label="Suggested questions">
            {STARTERS.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea ref={field} rows={1} value={input} maxLength={1500} placeholder="Type your question…" aria-label="Your message" enterKeyHint="send"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }} />
          <button type="submit" className="chat-send" disabled={busy || !input.trim()} aria-label="Send">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
        <p className="chat-foot">Your written quote from dispatch is final.</p>
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
