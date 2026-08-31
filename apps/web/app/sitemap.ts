import type { MetadataRoute } from "next";

import { getDictionary } from "./_content/i18n";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  // Not a Next route: Caddy proxies /presentation/ to the `presentation`
  // nginx container (apps/presentation). It is listed here because it is a
  // public, linked, indexable page — the sitemap describes the site, not this
  // app's router. Trailing slash is canonical; the bare path 308s to it.
  { path: "/presentation/", priority: 0.6, changeFrequency: "monthly" },
  { path: "/login", priority: 0.3, changeFrequency: "monthly" },
  { path: "/register", priority: 0.4, changeFrequency: "monthly" },
  { path: "/forgot-password", priority: 0.2, changeFrequency: "monthly" },
] as const;

function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? getDictionary().common.metadata.siteUrl);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date("2026-08-22T00:00:00.000Z");

  return publicRoutes.map((route) => ({
    url: new URL(route.path, siteUrl).toString(),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
