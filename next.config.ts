import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // روی Netlify خروجی standalone لازم نیست (رانتایم خودش مدیریت می‌کند)
  output: process.env.NETLIFY ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
