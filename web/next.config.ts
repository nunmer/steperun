import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      // Cache client-side navigations for 5 minutes
      // so returning to an already-visited page is instant
      dynamic: 300,
      static: 300,
    },
  },
};

export default nextConfig;
