"use server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { CATEGORIES, ghs, parseSpecs } from "@/lib/format";
import { slugify, suggestMachineFromImage, type FleetContextItem, type MachineSuggestion } from "@/lib/ai-machine";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export type AiSuggestState =
  | { ok: true; suggestion: MachineSuggestion }
  | { ok: false; error: string };

/** Next free slug: base, base-2, base-3… */
function uniqueSlug(base: string, taken: Set<string>) {
  const b = slugify(base) || "machine";
  if (!taken.has(b)) return b;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${b}-${i}`)) return `${b}-${i}`;
  return `${b}-${Date.now().toString(36)}`;
}

/**
 * Reads a machine photo with AI and returns suggested Fleet form fields. Saves nothing: the admin checks
 * the fields and saves through saveMachine. Optional `id` = the machine being edited (its own slug is not a clash).
 */
export async function suggestMachineFromPhoto(fd: FormData): Promise<AiSuggestState> {
  const s = await requireSession();
  const photo = fd.get("photo");
  const editingId = String(fd.get("id") ?? "").trim() || null;
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: "Choose a photo first." };
  if (!TYPES.has(photo.type)) return { ok: false, error: "The photo must be a JPEG, PNG or WebP image." };
  if (photo.size > MAX_BYTES) return { ok: false, error: "Photo must be under 5 MB." };

  let fleet: FleetContextItem[] = [];
  const taken = new Set<string>();
  try {
    const rows = await prisma.machine.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, category: true, categoryLabel: true, dayRate: true, rateUnit: true, operatorRate: true, fuelLPerDay: true, selfDrive: true, specs: true, hidden: true },
    });
    for (const r of rows) if (r.id !== editingId) taken.add(r.slug);
    fleet = rows.filter((r) => !r.hidden).map(({ id: _id, hidden: _h, specs, ...r }) => ({ ...r, specs: parseSpecs(specs) }));
  } catch (e) {
    console.error("ai suggest: fleet lookup failed", e);
    return { ok: false, error: "Could not load the fleet to compare against. Try again." };
  }

  const image = new Uint8Array(await photo.arrayBuffer());
  const res = await suggestMachineFromImage({ image, mediaType: photo.type, fleet });
  if (!res.ok) return { ok: false, error: res.error };

  const suggestion = { ...res.suggestion, slug: uniqueSlug(res.suggestion.slug, taken) };
  const rate = suggestion.dayRate != null ? `, ${ghs(suggestion.dayRate)}/${suggestion.rateUnit}` : ", no rate suggested";
  const cost = res.meta.costUsd != null ? `, $${res.meta.costUsd.toFixed(4)}` : "";
  try {
    await logActivity(
      s,
      "machine.ai_suggest",
      `AI read photo: suggested ${suggestion.name} (${CATEGORIES[suggestion.category] ?? suggestion.category})${rate}, confidence ${suggestion.confidence} [${(res.meta.ms / 1000).toFixed(1)} s${cost}]`,
      editingId ? { type: "machine", id: editingId } : undefined,
    );
  } catch (e) {
    console.error("ai suggest: activity log failed", e);
  }
  return { ok: true, suggestion };
}
