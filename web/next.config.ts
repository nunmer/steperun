import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
    middlewareClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
