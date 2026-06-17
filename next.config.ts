import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.6", "localhost:3000"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "192.168.1.6:3000"],
    },
  },
};

export default nextConfig;
