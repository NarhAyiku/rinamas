// AI "fill from photo": reads a machine photo and suggests Fleet form fields.
// Imports are limited to `ai`, `zod` and relative paths so it can be exercised from a plain node script.
// Nothing here writes to the database; the admin reviews the suggestion and saves through saveMachine.
import { generateText, Output } from "ai";
import { z } from "zod";

/** Vercel AI Gateway model string. Auth is OIDC (VERCEL_OIDC_TOKEN locally, automatic on Vercel). */
export const AI_MACHINE_MODEL = "anthropic/claude-sonnet-5.5";

export const MACHINE_CATEGORIES = ["earth", "haul", "road", "lift"] as const;

/** One existing fleet machine, given to the model so names, labels, specs and rates match the house style. */
export type FleetContextItem = {
  name: string;
  slug: string;
  category: string;
  categoryLabel: string;
  dayRate: number;
  rateUnit: string;
  operatorRate: number | null;
  fuelLPerDay: number | null;
  selfDrive: boolean;
  specs: [string, string][];
};

/** The validated suggestion handed to the form. */
export const machineSuggestionSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(60),
  category: z.enum(MACHINE_CATEGORIES),
  categoryLabel: z.string().min(2).max(60),
  specs: z.array(z.object({ label: z.string().min(1).max(40), value: z.string().min(1).max(120) })).min(1).max(5),
  rateUnit: z.enum(["day", "trip"]),
  selfDrive: z.boolean(),
  fuelLPerDay: z.number().int().min(0).max(5000).nullable(),
  dayRate: z.number().int().min(0).nullable(),
  operatorRate: z.number().int().min(0).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string().max(600),
});
export type MachineSuggestion = z.infer<typeof machineSuggestionSchema>;

export type SuggestMeta = {
  model: string;
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  seen?: string;
};

export type SuggestResult =
  | { ok: true; suggestion: MachineSuggestion; meta: SuggestMeta }
  | { ok: false; error: string; meta?: SuggestMeta };

// What the model is asked to fill. Deliberately loose (no regex or array bounds, which not every provider's
// structured-output mode accepts); the result is normalised and then checked against machineSuggestionSchema.
const modelOutputSchema = z.object({
  seen: z.string().describe("One short sentence: what the photo shows (machine type, make/model if legible, setting)."),
  isConstructionMachine: z.boolean().describe("True only if the main subject is a construction/heavy-equipment machine or haulage vehicle RINAMAS could hire out."),
  rejectReason: z.string().nullable().describe("If isConstructionMachine is false, a short plain reason for the admin (e.g. 'This looks like a family car, not a construction machine'). Otherwise null."),
  name: z.string().describe("Display name in the fleet's style, e.g. 'JCB 3CX backhoe loader' or 'Mobile crane, 50T'. Brand only if visible."),
  slug: z.string().describe("URL slug: lowercase a-z, 0-9 and dashes only, short, e.g. 'jcb-3cx-backhoe'."),
  category: z.enum(MACHINE_CATEGORIES).describe("earth = Earthmoving, haul = Haulage, road = Road & compaction, lift = Lifting / loading."),
  categoryLabel: z.string().describe("'<Group> · <Use>' exactly like the fleet, e.g. 'Lifting · Telehandler', 'Earthmoving · Utilities'."),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).describe("3 to 5 practical spec lines like the fleet's: e.g. {label:'Operating weight', value:'8 T'}; last line {label:'Best for', value:'...'}."),
  rateUnit: z.enum(["day", "trip"]).describe("'trip' only for low bed trailers; everything else 'day'."),
  selfDrive: z.boolean().describe("True for vehicles that drive themselves to site (tipper trucks, low beds, water tankers, truck-mounted cranes). False for machines moved by low bed."),
  fuelLPerDay: z.number().nullable().describe("Typical diesel litres per 8-hour working day for this class, or null where the fleet uses null for comparable vehicles (trucks, low beds)."),
  dayRate: z.number().nullable().describe("Suggested hire rate in GH₵ (integer) per day (or per trip for a low bed), anchored to comparable fleet machines. Null if nothing in the fleet is comparable."),
  operatorRate: z.number().nullable().describe("Operator GH₵ per day, anchored to comparable fleet machines. Null where the fleet uses null (driver included, e.g. trucks) or if nothing is comparable."),
  confidence: z.enum(["low", "medium", "high"]).describe("How sure you are of the machine type and size class from this photo."),
  notes: z.string().describe("One or two short sentences telling the admin what to double-check (size class, make/model, rate)."),
});

const INSTRUCTIONS = `You help the staff of RINAMAS Equipment and Trading Enterprise (heavy-equipment hire, Accra, Ghana) add machines to their hire fleet.
From one photo you identify the machine and draft the fleet form. A human checks and corrects every field before saving, so be useful but honest.

Rules:
- Match the house style of the existing fleet given below: naming ("JCB excavator, 20T class", "Backhoe loader", "Mobile crane, 50T"), the category the fleet uses for comparable machines, "Group · Use" category labels, spec labels and value formats (ranges like "20–22 T", units like T, m, m³, kW), and a final "Best for" line.
- Specs: 3–5 lines that are typical for the visible machine class. Do not invent model-specific precision that the photo and the class do not support; use class ranges when unsure.
- Brand/model only when a badge or very distinctive design is visible. Never guess a model number you cannot see.
- Rates are Ghana cedis (GH₵), whole numbers. Anchor dayRate and operatorRate to the comparable machines in the fleet (same type, scale by size class). If nothing comparable exists, return null rather than guessing.
- rateUnit is "trip" only for low bed trailers. selfDrive is true for trucks, tippers, tankers and low beds.
- fuelLPerDay: typical diesel use per 8-hour day; follow the fleet's convention of null for trucks and low beds.
- If the photo does not show a construction machine or haulage vehicle (a person, car, building, document, blurry nothing), set isConstructionMachine to false, explain in rejectReason, and fill the other fields with minimal placeholders.
- notes: tell the admin exactly what to verify (e.g. tonnage class, attachments, whether the rate fits).`;

function fleetBlock(fleet: FleetContextItem[]) {
  if (!fleet.length) return "The fleet is currently empty; use your best judgement for Ghana hire rates or return null for rates.";
  const lines = fleet.map((m) =>
    JSON.stringify({
      name: m.name, slug: m.slug, category: m.category, categoryLabel: m.categoryLabel,
      rate: `${m.dayRate}/${m.rateUnit}`, operatorRate: m.operatorRate, fuelLPerDay: m.fuelLPerDay, selfDrive: m.selfDrive,
      specs: m.specs.map(([k, v]) => `${k}: ${v}`),
    }),
  );
  return `Current RINAMAS fleet (one JSON object per line):\n${lines.join("\n")}`;
}

export function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

const intOrNull = (n: number | null | undefined, max = 10_000_000) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), max) : null;

/** Turn the model's loose output into something the strict schema accepts. */
function normalise(o: z.infer<typeof modelOutputSchema>): unknown {
  const specs = (o.specs ?? [])
    .map((s) => ({ label: String(s.label ?? "").replace(/:/g, "").trim().slice(0, 40), value: String(s.value ?? "").replace(/\s+/g, " ").trim().slice(0, 120) }))
    .filter((s) => s.label && s.value)
    .slice(0, 5);
  const name = o.name.trim().slice(0, 80);
  return {
    name,
    slug: slugify(o.slug) || slugify(name),
    category: o.category,
    categoryLabel: o.categoryLabel.trim().slice(0, 60),
    specs,
    rateUnit: o.rateUnit,
    selfDrive: o.selfDrive,
    fuelLPerDay: intOrNull(o.fuelLPerDay, 5000),
    dayRate: intOrNull(o.dayRate),
    operatorRate: intOrNull(o.operatorRate),
    confidence: o.confidence,
    notes: o.notes.trim().slice(0, 600),
  };
}

/** Friendly message for gateway / provider failures. Never includes tokens or stack traces. */
function friendlyError(e: unknown): string {
  const err = e as { name?: string; statusCode?: number; message?: string; cause?: unknown };
  const name = err?.name ?? "";
  const status = err?.statusCode;
  const msg = (err?.message ?? "").toLowerCase();
  if (name.includes("Authentication") || status === 401 || msg.includes("oidc") || msg.includes("api key")) {
    return "The AI service could not sign in (the Vercel AI Gateway token is missing or expired). Fill the fields by hand for now and tell the CEO.";
  }
  if (msg.includes("credit card")) {
    return "AI photo fill is not switched on yet: the Vercel team needs a payment card on file for AI Gateway. Fill the fields by hand for now and tell the CEO.";
  }
  if (msg.includes("credit") || msg.includes("insufficient") || msg.includes("payment") || status === 402) {
    return "The AI service has run out of credits. Fill the fields by hand for now and tell the CEO.";
  }
  if (name.includes("Forbidden") || status === 403) return "The AI service is not enabled for this account. Fill the fields by hand for now and tell the CEO.";
  if (name.includes("RateLimit") || status === 429) return "The AI service is busy. Wait a minute and try again, or fill the fields by hand.";
  if (name.includes("Timeout") || name === "AbortError" || msg.includes("timeout") || msg.includes("aborted")) return "The AI took too long to read the photo. Try again, or fill the fields by hand.";
  if (name.includes("NoObjectGenerated") || name.includes("NoOutputGenerated") || name.includes("TypeValidation")) return "The AI could not make sense of this photo. Try a clearer side-on photo of the whole machine, or fill the fields by hand.";
  return "The AI could not read the photo right now. Try again, or fill the fields by hand.";
}

export async function suggestMachineFromImage(args: {
  image: Uint8Array;
  mediaType: string;
  fleet: FleetContextItem[];
  /** Gateway model string (default AI_MACHINE_MODEL) or a model instance, e.g. a mock in tests. */
  model?: Parameters<typeof generateText>[0]["model"];
  timeoutMs?: number;
}): Promise<SuggestResult> {
  const model = args.model ?? AI_MACHINE_MODEL;
  const modelId = typeof model === "string" ? model : "custom";
  const started = Date.now();
  let result;
  try {
    result = await generateText({
      model,
      instructions: INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${fleetBlock(args.fleet)}\n\nRead the attached photo and draft the fleet form for this machine.` },
            { type: "file", mediaType: args.mediaType, data: args.image },
          ],
        },
      ],
      output: Output.object({ schema: modelOutputSchema, name: "machine_suggestion", description: "Draft Fleet form fields for the machine in the photo" }),
      maxRetries: 1,
      timeout: args.timeoutMs ?? 60_000,
    });
  } catch (e) {
    const meta: SuggestMeta = { model: modelId, ms: Date.now() - started };
    console.error("ai-machine: generateText failed", { name: (e as Error)?.name, message: (e as Error)?.message });
    return { ok: false, error: friendlyError(e), meta };
  }

  const gw = (result.providerMetadata as Record<string, Record<string, unknown>> | undefined)?.gateway;
  const cost = Number(gw?.cost ?? gw?.marketCost);
  const meta: SuggestMeta = {
    model: modelId,
    ms: Date.now() - started,
    inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens,
    costUsd: Number.isFinite(cost) ? cost : undefined,
  };

  const out = result.output;
  meta.seen = out?.seen;
  if (!out) return { ok: false, error: "The AI could not make sense of this photo. Try a clearer photo, or fill the fields by hand.", meta };
  if (!out.isConstructionMachine) {
    const why = (out.rejectReason ?? "").trim().replace(/[.!]*$/, "");
    return { ok: false, error: `This does not look like a construction machine${why ? ` (${why})` : ""}. Choose a clear photo of the machine, or fill the fields by hand.`, meta };
  }
  const parsed = machineSuggestionSchema.safeParse(normalise(out));
  if (!parsed.success) {
    console.error("ai-machine: suggestion failed validation", parsed.error.issues.slice(0, 3));
    return { ok: false, error: "The AI's answer was incomplete. Try again, or fill the fields by hand.", meta };
  }
  return { ok: true, suggestion: parsed.data, meta };
}
