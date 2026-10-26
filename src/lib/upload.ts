import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Store an uploaded machine photo and return its public URL.
 * Production (Vercel) uses Vercel Blob via BLOB_READ_WRITE_TOKEN; without a token it writes to public/img (local dev).
 */
export async function storePhoto(file: File, slug: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Photo must be a JPG, PNG or WebP image.");
  if (file.size > MAX_BYTES) throw new Error("Photo must be under 5 MB.");
  const name = `${slug}-${Date.now()}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`machines/${name}`, file, { access: "public", contentType: file.type });
    return blob.url;
  }
  if (process.env.VERCEL) throw new Error("Image uploads need a Blob store: add one under Storage in the Vercel project.");
  const dir = path.join(process.cwd(), "public", "img");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/img/${name}`;
}
