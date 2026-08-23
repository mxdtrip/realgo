import type { NextConfig } from "next";
import { join } from "node:path";

// Dev-only escape hatch for the product presentation.
//
// In every deployed environment /presentation is Caddy's business: it strips
// the prefix and proxies to the `presentation` nginx container, so Next never
// sees those requests (see Caddyfile / Caddyfile.internal). But a bare
// `npm run dev` on :3000 has no Caddy in front of it, which would make the
// footer link and the hackathon notice 404 for anyone working on the landing
// page. Point this at a locally running deck to close that gap:
//
//   docker compose up -d presentation caddy   # deck on :8080/presentation/
//   PRESENTATION_ORIGIN=http://127.0.0.1:8080/presentation npm run dev
//
// Unset (the default) the presentation rewrite stays empty. The Docker build
// also keeps the API rewrite disabled because it runs with NODE_ENV=production.
const presentationOrigin = process.env.PRESENTATION_ORIGIN?.replace(/\/+$/, "");
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

// `npm run dev` serves the web app directly on :3000 while the local API is
// exposed by Caddy on :8080. The browser must still use relative `/api/*`
// requests (the same code is built for realgo.dev), so proxy those requests
// only in the dev server. Production builds keep the list empty and continue
// to rely on Caddy's same-origin API route.
const localApiOrigin =
  process.env.NODE_ENV === "development" && !configuredApiBase
    ? (process.env.LOCAL_API_ORIGIN ?? "http://127.0.0.1:8080").replace(/\/+$/, "")
    : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for the production
  // Docker image; see apps/web/Dockerfile.
  output: "standalone",
  turbopack: {
    root: join(__dirname),
  },
  async rewrites() {
    const rewrites = [];

    if (presentationOrigin) {
      rewrites.push(
        { source: "/presentation", destination: `${presentationOrigin}/` },
        { source: "/presentation/:path*", destination: `${presentationOrigin}/:path*` },
      );
    }

    if (localApiOrigin) {
      rewrites.push({ source: "/api/:path*", destination: `${localApiOrigin}/api/:path*` });
    }

    return rewrites;
  },
};

export default nextConfig;
