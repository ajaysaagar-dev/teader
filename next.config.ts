import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;

