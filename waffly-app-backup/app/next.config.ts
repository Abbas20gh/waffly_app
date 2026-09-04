import type { NextConfig } from "next";

// CF_EXPORT=1 → بیلد استاتیک برای Cloudflare Pages (API ها در functions/ هستند)
const isExport = process.env.CF_EXPORT === "1";

const nextConfig: NextConfig = {
  output: isExport ? "export" : "standalone",
  ...(isExport ? { images: { unoptimized: true } } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
