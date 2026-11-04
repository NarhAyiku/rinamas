import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { NextResponse } from "next/server";
import { loadPublic } from "@/lib/public-data";
import { activeAssistantTools, ASSISTANT_MODEL, assistantEnabled, assistantInstructions, assistantTools } from "@/lib/assistant";
import { clientIp, rateLimiter } from "@/lib/ratelimit";
import { DISPATCH_PHONE } from "@/lib/contact";

// 40 messages per IP per 10 minutes: plenty for a real conversation, a ceiling on what one visitor can spend.
const limited = rateLimiter(40, 10 * 60 * 1000);
const MAX_MESSAGES = 20;
const MAX_TEXT = 1500;

const BUSY = `Sorry, the assistant is busy right now. Please call or WhatsApp dispatch on ${DISPATCH_PHONE.display}.`;

export async function POST(req: Request) {
  if (!assistantEnabled()) return NextResponse.json({ error: "Chat is not available" }, { status: 404 });
  if (limited(clientIp(req))) return NextResponse.json({ error: `Lots of messages from this connection. Please call or WhatsApp ${DISPATCH_PHONE.display}.` }, { status: 429 });

  let messages: UIMessage[];
  try { ({ messages } = await req.json()); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  // Only the recent conversation goes to the model, and no single message may be long.
  messages = messages.slice(-MAX_MESSAGES);
  const tooLong = messages.some((m) => m.role === "user" && m.parts?.some((p) => p.type === "text" && p.text.length > MAX_TEXT));
  if (tooLong) return NextResponse.json({ error: "That message is too long. Please keep it short, or call dispatch." }, { status: 400 });

  const data = await loadPublic();
  const tools = assistantTools(data);
  const result = streamText({
    model: groq(ASSISTANT_MODEL),
    instructions: assistantInstructions(data),
    messages: await convertToModelMessages(messages.filter((m) => m.role !== "system"), { tools, ignoreIncompleteToolCalls: true }),
    tools,
    activeTools: activeAssistantTools(data.pricing.showPrices),
    toolApproval: { submitHireRequest: "user-approval" },
    stopWhen: isStepCount(4),
    maxOutputTokens: 900,
    providerOptions: { groq: { reasoningEffort: "low", reasoningFormat: "hidden" } },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      sendReasoning: false,
      onError: (e) => { console.error("chat error", e); return BUSY; },
    }),
  });
}
