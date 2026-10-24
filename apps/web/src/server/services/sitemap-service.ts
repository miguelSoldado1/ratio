import { and, count, desc, eq, gte, isNotNull, max, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { listItems, lists, reviews, user } from "@/lib/db/schema";
import { getCanonicalUrl } from "@/lib/seo";

const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";
const SITEMAP_CACHE_KEY = "sitemap:v1";

// Keeps the four dynamic sections under the 50,000 URL limit of a single sitemap file.
const SITEMAP_SECTION_LIMIT = 12_000;

const staticEntries: SitemapEntry[] = [
  { path: "/" },
  { lastModified: "2026-07-28", path: "/privacy" },
  { lastModified: "2026-07-28", path: "/terms" },
];

type CloudflareWorkersModule = typeof import("cloudflare:workers");

interface SitemapEntry {
  lastModified?: Date | string | null;
  path: string;
}

export async function getSitemapXml() {
  const cache = await getCacheBinding();
  const cachedXml = await cache?.get(SITEMAP_CACHE_KEY).catch(() => null);
  if (cachedXml) return cachedXml;

  const xml = await createSitemapXml();
  await cache?.put(SITEMAP_CACHE_KEY, xml).catch((error) => console.error("sitemap_cache_write_error", error));

  return xml;
}

export async function refreshSitemapCache(cache: KVNamespace) {
  await cache.put(SITEMAP_CACHE_KEY, await createSitemapXml());
}

export async function createSitemapXml() {
  const entries = [...staticEntries, ...(await getDynamicSitemapEntries())];
  const urls = entries.map(({ lastModified, path }) => {
    const lastmod = lastModified ? `<lastmod>${formatLastModified(lastModified)}</lastmod>` : "";

    return `<url><loc>${escapeXml(getCanonicalUrl(path))}</loc>${lastmod}</url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

async function getDynamicSitemapEntries() {
  const db = await getDb();
  const visibleAuthor = sql`${user.banned} is not true`;
  const writtenReview = and(isNotNull(reviews.body), visibleAuthor);
  const latestReviewUpdate = max(reviews.updatedAt);

  const [albumRows, reviewRows, profileRows, listRows] = await Promise.all([
    db
      .select({ id: reviews.albumId, lastModified: latestReviewUpdate })
      .from(reviews)
      .innerJoin(user, eq(reviews.userId, user.id))
      .where(writtenReview)
      .groupBy(reviews.albumId)
      .orderBy(desc(latestReviewUpdate))
      .limit(SITEMAP_SECTION_LIMIT),
    db
      .select({ id: reviews.id, lastModified: reviews.updatedAt })
      .from(reviews)
      .innerJoin(user, eq(reviews.userId, user.id))
      .where(writtenReview)
      .orderBy(desc(reviews.updatedAt))
      .limit(SITEMAP_SECTION_LIMIT),
    db
      .select({ lastModified: latestReviewUpdate, username: user.username })
      .from(reviews)
      .innerJoin(user, eq(reviews.userId, user.id))
      .where(and(writtenReview, isNotNull(user.username)))
      .groupBy(user.username)
      .orderBy(desc(latestReviewUpdate))
      .limit(SITEMAP_SECTION_LIMIT),
    db
      .select({ id: lists.id, lastModified: lists.updatedAt })
      .from(lists)
      .innerJoin(user, eq(lists.userId, user.id))
      .innerJoin(listItems, eq(listItems.listId, lists.id))
      .where(and(visibleAuthor, isNotNull(user.username)))
      .groupBy(lists.id)
      .having(gte(count(), 3))
      .orderBy(desc(lists.updatedAt))
      .limit(SITEMAP_SECTION_LIMIT),
  ]);

  return [
    ...albumRows.map((row) => ({ lastModified: row.lastModified, path: `/album/${encodeURIComponent(row.id)}` })),
    ...reviewRows.map((row) => ({ lastModified: row.lastModified, path: `/review/${row.id}` })),
    ...profileRows.flatMap((row) =>
      row.username ? [{ lastModified: row.lastModified, path: `/user/${encodeURIComponent(row.username)}` }] : []
    ),
    ...listRows.map((row) => ({ lastModified: row.lastModified, path: `/list/${row.id}` })),
  ] satisfies SitemapEntry[];
}

function formatLastModified(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function getCacheBinding() {
  if (typeof navigator === "undefined" || navigator.userAgent !== "Cloudflare-Workers") return null;

  try {
    const cloudflareWorkers: CloudflareWorkersModule = await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE);
    return cloudflareWorkers.env.CACHE;
  } catch {
    return null;
  }
}
