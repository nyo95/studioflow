import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["172.16.1.13", "localhost:3000"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "172.16.1.13:3000"],
    },
  },
};

export default nextConfig;
