import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  outputFileTracingRoot: __dirname,
  // Lets a production build run beside a live `next dev` without clobbering its .next folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
