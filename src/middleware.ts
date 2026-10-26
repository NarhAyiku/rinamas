import { NextResponse, type NextRequest } from "next/server";

// Pass the pathname to server layouts so the admin layout can exempt /admin/login.
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/admin/:path*"] };
