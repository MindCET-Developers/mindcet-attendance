import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the shared TS package (consumed directly from source).
  transpilePackages: ["@att/shared"],
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
