import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // PGlite (lokální Postgres ve WASM) se nebundluje, načítá se za běhu.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      // Limit nahrávky je 4 MB (Vercel přijme nejvýš 4,5 MB), rezerva pro multipart.
      bodySizeLimit: "4200kb",
    },
  },
};

export default nextConfig;
