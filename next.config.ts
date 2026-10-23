import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Calendar screenshots are sent to a server action as base64 - raise the default 1MB cap.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
