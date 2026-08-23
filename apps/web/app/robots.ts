import type { MetadataRoute } from "next";

import { getDictionary } from "./_content/i18n";

function getSiteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? getDictionary().common.metadata.siteUrl);
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      disallow: [
        "/dashboard",
        "/reviews",
        "/problems",
        "/roadmap",
        "/patterns",
        "/cards",
        "/extension",
        "/settings",
        "/onboarding",
        // Hackathon pitch deck and its legacy standalone copy: real content
        // for humans following the footer/changelog link, but not something
        // people search for and not worth indexing — see /presentation and
        // /pitch-deck.html noindex meta tags for the belt-and-suspenders half
        // of this (robots.txt disallow alone can still leave a URL indexed
        // with no snippet if it's linked from elsewhere).
        "/presentation",
        "/pitch-deck.html",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl.origin,
  };
}
