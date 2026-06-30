import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Transpile the shared TS package (consumed directly from source).
  transpilePackages: ["@att/shared"],
  // Fix "multiple lockfiles" warning — pin tracing root to the monorepo root
  // so Next.js doesn't accidentally pick up a system-level package-lock.json.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  eslint: {
    // Linting is run separately; don't fail production builds on it.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Allow Server Actions / route handlers to use Node APIs (exceljs, googleapis).
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
