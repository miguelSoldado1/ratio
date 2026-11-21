import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { albums, listItems, lists, user } from "@/lib/db/schema";

const imageSize = 1200;
const mosaicCoverCount = 4;
const tileSize = imageSize / 2;
const versionLength = 12;
const layoutVersion = "square-1200";

export function getListShareMosaicCovers(albumRows: { coverUrl: string | null }[]) {
  const covers = albumRows.slice(0, mosaicCoverCount).flatMap((album) => (album.coverUrl ? [album.coverUrl] : []));
  return covers.length === mosaicCoverCount ? covers : null;
}

export async function getListShareImagePath(listId: string, covers: string[]) {
  return `/api/og/list/${encodeURIComponent(listId)}?v=${await getListShareImageVersion(covers)}`;
}

export async function createListShareImageResponse(request: Request, listId: string) {
  const edgeCache = getEdgeCache();
  const cachedResponse = await edgeCache?.match(request.url);
  if (cachedResponse) return cachedResponse;

  const covers = await getVisibleListMosaicCovers(listId);
  if (!covers) return new Response("Not found", { status: 404 });

  const response = await renderMosaic(covers);
  if (!response) return Response.redirect(covers[0], 302);

  await edgeCache?.put(request.url, response.clone());
  return response;
}

async function renderMosaic(covers: string[]) {
  const draw = covers.map((url, index) => ({
    height: tileSize,
    left: (index % 2) * tileSize,
    top: Math.floor(index / 2) * tileSize,
    url,
    width: tileSize,
  }));

  try {
    const image = await fetch(covers[0], {
      cf: {
        image: {
          draw,
          fit: "cover",
          format: "jpeg",
          height: imageSize,
          width: imageSize,
        },
      },
    } as RequestInit);

    const contentType = image.headers.get("content-type");
    const cfResized = image.headers.get("cf-resized");
    if (!(image.ok && contentType?.startsWith("image/") && cfResized) || cfResized.includes("err=")) {
      console.warn("list_share_image_error", { cfResized, status: image.status });
      return null;
    }

    return new Response(image.body, {
      headers: { "Cache-Control": "public, max-age=604800", "Content-Type": contentType },
    });
  } catch (error) {
    console.warn("list_share_image_error", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function getVisibleListMosaicCovers(listId: string) {
  const db = await getDb();
  const rows = await db
    .select({ coverUrl: albums.coverUrl })
    .from(lists)
    .innerJoin(user, eq(lists.userId, user.id))
    .innerJoin(listItems, eq(listItems.listId, lists.id))
    .innerJoin(albums, eq(listItems.albumId, albums.id))
    .where(and(eq(lists.id, listId), sql`${user.banned} is not true`, isNotNull(user.username)))
    .orderBy(desc(listItems.position))
    .limit(mosaicCoverCount);

  return getListShareMosaicCovers(rows);
}

async function getListShareImageVersion(covers: string[]) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode([layoutVersion, ...covers].join("\n")));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, versionLength);
}

function getEdgeCache() {
  if (typeof caches === "undefined" || !("default" in caches)) return null;
  return (caches as unknown as { default: Cache }).default;
}
