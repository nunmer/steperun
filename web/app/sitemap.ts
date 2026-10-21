import type { MetadataRoute } from "next";
import { getEvents } from "@/lib/queries";

const SITE = "https://www.steppe.run";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getEvents();
  const pages = ["", "/events", "/rankings", "/power-rankings", "/runners", "/run-analyzer"].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.8,
  }));
  return [
    ...pages,
    ...events.map((e) => ({
      url: `${SITE}/events/${e.slug}`,
      lastModified: e.scraped_at ?? undefined,
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
