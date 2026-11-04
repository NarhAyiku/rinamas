import type { NextConfig } from "next";

// PostHog ingestion host for the /ingest proxy (see src/components/Analytics.tsx); assets live on a sibling host.
const POSTHOG = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
const POSTHOG_ASSETS = POSTHOG.replace("://us.i.", "://us-assets.i.").replace("://eu.i.", "://eu-assets.i.");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { formats: ["image/avif", "image/webp"], remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }] },
  async headers() {
    return [{ source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] }];
  },
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${POSTHOG_ASSETS}/static/:path*` },
      { source: "/ingest/:path*", destination: `${POSTHOG}/:path*` },
    ];
  },
  skipTrailingSlashRedirect: true, // PostHog's API paths end in a slash
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  outputFileTracingRoot: __dirname,
  // Lets a production build run beside a live `next dev` without clobbering its .next folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
