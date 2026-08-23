import type { MetadataRoute } from "next";

import { getDictionary } from "./_content/i18n";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  // Real, indexable Russian content — was missing from the sitemap entirely
  // even though robots.ts never disallowed it.
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/docs", priority: 0.8, changeFrequency: "monthly" },
  { path: "/anki-export", priority: 0.4, changeFrequency: "monthly" },
  { path: "/changelog", priority: 0.5, changeFrequency: "weekly" },
  { path: "/support", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/offer", priority: 0.2, changeFrequency: "yearly" },
  // /presentation, /checkout, /login and /register are intentionally left
  // out: they're noindexed (see their own metadata / meta tags) — a
  // noindexed URL has no business being in the sitemap.
] as const;

function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? getDictionary().common.metadata.siteUrl);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date("2026-07-01T00:00:00.000Z");

  return publicRoutes.map((route) => ({
    url: new URL(route.path, siteUrl).toString(),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
