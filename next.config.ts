import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders({
          dev: process.env.NODE_ENV === "development",
          // Only on Vercel, which always serves HTTPS; local `next start` stays plain HTTP.
          httpsOnly: Boolean(process.env.VERCEL),
        }),
      },
    ];
  },
};

export default nextConfig;
