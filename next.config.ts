import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end runs use a separate directory so they can start beside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The container runs the traced server and the native SQLite module.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@google-cloud/storage"],
};

export default nextConfig;
