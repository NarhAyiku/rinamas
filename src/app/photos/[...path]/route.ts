import { NextResponse, type NextRequest } from "next/server";
import { PHOTO_PREFIX } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Serves machine photos from the private Blob store. File names carry a timestamp, so responses are cached as immutable. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathname = path.join("/");
  if (!pathname.startsWith(`${PHOTO_PREFIX}/`) || pathname.includes("..") || !/^[a-z0-9/_.-]+$/i.test(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!process.env.BLOB_STORE_ID) return new NextResponse("Photo store not configured", { status: 404 });

  const { get } = await import("@vercel/blob");
  const ifNoneMatch = req.headers.get("if-none-match") ?? undefined;
  const result = await get(pathname, { access: "private", ifNoneMatch });
  if (!result) return new NextResponse("Not found", { status: 404 });
  const cache = "public, max-age=31536000, immutable";
  if (result.statusCode === 304) return new NextResponse(null, { status: 304, headers: { "Cache-Control": cache } });
  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      "Content-Type": result.blob.contentType ?? "image/jpeg",
      "Cache-Control": cache,
      ...(result.blob.etag ? { ETag: result.blob.etag } : {}),
    },
  });
}
