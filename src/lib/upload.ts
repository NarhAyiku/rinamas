import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;

/** Pathname prefix inside the Blob store; also the public route that serves private blobs. */
export const PHOTO_PREFIX = "machines";

/**
 * Store an uploaded machine photo and return the URL to put in Machine.image.
 * - Private Blob store (BLOB_STORE_ID, OIDC credentials on Vercel): uploads with access "private",
 *   returns "/photos/machines/<name>" which the /photos route streams from the store.
 * - Public Blob store (BLOB_READ_WRITE_TOKEN): uploads with access "public", returns the blob URL.
 * - Local dev with neither: writes to public/img.
 */
export async function storePhoto(file: File, slug: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Photo must be a JPG, PNG or WebP image.");
  if (file.size > MAX_BYTES) throw new Error("Photo must be under 5 MB.");
  const name = `${slug}-${Date.now()}.${ext}`;
  const pathname = `${PHOTO_PREFIX}/${name}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(pathname, file, { access: "public", contentType: file.type });
    return blob.url;
  }
  if (process.env.BLOB_STORE_ID) {
    const { put } = await import("@vercel/blob");
    await put(pathname, file, { access: "private", contentType: file.type, addRandomSuffix: false });
    return `/photos/${pathname}`;
  }
  if (process.env.VERCEL) throw new Error("Image uploads need a Blob store: create one under Storage in the Vercel project and redeploy.");
  const dir = path.join(process.cwd(), "public", "img");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/img/${name}`;
}
