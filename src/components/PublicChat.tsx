import { assistantEnabled } from "@/lib/assistant";
import { ChatWidget } from "./ChatWidget";

/** The "Ask RINAMAS" chat, rendered only when GROQ_API_KEY is set so the site never shows a chat that can't answer. */
export function PublicChat({ machines, wa }: { machines: { slug: string; name: string }[]; wa: string }) {
  if (!assistantEnabled()) return null;
  return <ChatWidget machines={machines.map((m) => ({ slug: m.slug, name: m.name }))} wa={wa} />;
}
