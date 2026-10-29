import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { formats: ["image/avif", "image/webp"], remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }] },
  async headers() {
    return [{ source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] }];
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  outputFileTracingRoot: __dirname,
  // Lets a production build run beside a live `next dev` without clobbering its .next folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
