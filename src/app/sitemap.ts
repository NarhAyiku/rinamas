import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { REGIONS } from "@/data/regions";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Every public page: the landing page, the machine index and pages, and the region pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const machines = await prisma.machine.findMany({ where: { hidden: false }, select: { slug: true, updatedAt: true }, orderBy: { sortOrder: "asc" } });
  const latest = machines.reduce((d, m) => (m.updatedAt > d ? m.updatedAt : d), new Date(0));
  return [
    { url: abs("/"), lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: abs("/hire"), lastModified: latest, changeFrequency: "weekly", priority: 0.9 },
    ...machines.map((m) => ({ url: abs(`/hire/${m.slug}`), lastModified: m.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...REGIONS.map((r) => ({ url: abs(`/regions/${r.slug}`), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
