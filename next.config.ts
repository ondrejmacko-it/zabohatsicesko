import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Hlavičky pro všechny odpovědi včetně statických souborů a prefetchů, které proxy (CSP s nonce)
  // vynechává. HSTS jen v produkčním buildu, lokální http by si ho prohlížeč nezapamatoval.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
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
