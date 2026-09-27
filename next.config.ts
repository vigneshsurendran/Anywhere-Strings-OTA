import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end runs use a separate directory so they can start beside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@google-cloud/storage"],
};

export default nextConfig;
