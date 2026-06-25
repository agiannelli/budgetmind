import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — a yarn.lock in the home directory otherwise
  // makes Next infer the wrong root for file tracing.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
