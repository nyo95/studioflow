import type { NextConfig } from "next";

// allowedDevOrigins diupdate otomatis oleh scripts/sync-ip.mjs
const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.16.1.163", "localhost:3000"],
};

export default nextConfig;
