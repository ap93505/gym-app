import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app"],
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
};

export default nextConfig;
