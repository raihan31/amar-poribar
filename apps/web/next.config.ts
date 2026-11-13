import type { NextConfig } from "next";

// Build id busts the service-worker cache (read by lib/pwa/register.ts).
const buildId = process.env.GITHUB_SHA ?? String(Date.now());

const config: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  transpilePackages: ["@amar-poribar/shared"],
};

export default config;
