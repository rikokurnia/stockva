import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
const config: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
};
export default (phase: string): NextConfig => ({
  ...config,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-production",
});
