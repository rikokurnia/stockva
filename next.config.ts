import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep validation builds isolated from an already-running development server.
  distDir: process.env.STOCKCITY_NEXT_DIST_DIR ?? ".next",
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
