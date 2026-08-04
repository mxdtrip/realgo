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
// Unset (the default, and what the Docker build uses) the rewrites list stays
// empty and nothing about the production request path changes.
const presentationOrigin = process.env.PRESENTATION_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) for the production
  // Docker image; see apps/web/Dockerfile.
  output: "standalone",
  turbopack: {
    root: join(__dirname),
  },
  async rewrites() {
    if (!presentationOrigin) return [];
    return [
      { source: "/presentation", destination: `${presentationOrigin}/` },
      { source: "/presentation/:path*", destination: `${presentationOrigin}/:path*` },
    ];
  },
};

export default nextConfig;
