import type { MetadataRoute } from "next";

const SITE = "https://www.steppe.run";

/**
 * Canonical pages are crawlable; filter/pagination variants and private areas
 * are not — each of those is an uncached database query for a crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/auth/",
        "/profile",
        "/coins",
        "/runners?",
        "/rankings?",
        "/power-rankings?",
        "/events?",
        "/events/*?",
        "/runners/head-to-head",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
