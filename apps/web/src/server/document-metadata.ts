import { and, eq, sql } from "drizzle-orm";
import z from "zod";
import { getDb } from "@/lib/db";
import { albums, reviews, user } from "@/lib/db/schema";
import { createAlbumPageTitle, createProfilePageTitle, createReviewPageTitle } from "@/lib/page-titles";
import { siteName } from "@/lib/seo";
import { enforceCloudflareRateLimitForRequest, spotifyCatalogRateLimit } from "./rate-limit";
import { getAlbumPersistenceMetadata } from "./services/spotify-service";
import type { DocumentMetadata } from "@/lib/document-metadata";

const albumIdSchema = z.string().trim().min(1).max(64);
const reviewIdSchema = z.uuid();
const usernameSchema = z.string().trim().min(1).max(64);

export type DocumentMetadataRoute =
  | { albumId: string; kind: "album" }
  | { kind: "profile"; username: string }
  | { kind: "review"; reviewId: string };

export function matchDocumentMetadataRoute(pathname: string): DocumentMetadataRoute | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return null;

  const value = decodePathSegment(segments[1]);
  if (!value) return null;

  if (segments[0] === "album") {
    const result = albumIdSchema.safeParse(value);
    return result.success ? { albumId: result.data, kind: "album" } : null;
  }

  if (segments[0] === "user") {
    const result = usernameSchema.safeParse(value);
    return result.success ? { kind: "profile", username: result.data } : null;
  }

  if (segments[0] === "review") {
    const result = reviewIdSchema.safeParse(value);
    return result.success ? { kind: "review", reviewId: result.data } : null;
  }

  return null;
}

export async function resolveDocumentMetadata(route: DocumentMetadataRoute, request: Request) {
  if (route.kind === "album") return await resolveAlbumDocumentMetadata(route.albumId, request);
  if (route.kind === "profile") return await resolveProfileDocumentMetadata(route.username);

  return await resolveReviewDocumentMetadata(route.reviewId);
}

async function resolveAlbumDocumentMetadata(albumId: string, request: Request) {
  const localAlbum = await getLocalAlbumMetadata(albumId);

  if (localAlbum) return createAlbumDocumentMetadata(albumId, localAlbum);

  await enforceCloudflareRateLimitForRequest(request, spotifyCatalogRateLimit);
  const spotifyAlbum = await getAlbumPersistenceMetadata(albumId);

  return createAlbumDocumentMetadata(albumId, spotifyAlbum);
}

async function getLocalAlbumMetadata(albumId: string) {
  const db = await getDb();
  const [album] = await db
    .select({ artistNames: albums.artistNames, coverUrl: albums.coverUrl, title: albums.title })
    .from(albums)
    .where(eq(albums.id, albumId))
    .limit(1);

  return album ?? null;
}

function createAlbumDocumentMetadata(
  albumId: string,
  album: { artistNames: string[]; coverUrl: string | null; title: string }
) {
  const artistNames = album.artistNames.length > 0 ? album.artistNames : ["Unknown Artist"];

  return {
    description: `Read reviews and ratings for ${album.title} by ${artistNames.join(", ")} on ${siteName}.`,
    image: album.coverUrl,
    imageAlt: album.coverUrl ? `${album.title} album cover` : `${siteName} album reviews`,
    path: `/album/${encodeURIComponent(albumId)}`,
    title: createAlbumPageTitle(album.title, artistNames[0]),
    type: "music.album",
  } satisfies DocumentMetadata;
}

async function resolveProfileDocumentMetadata(username: string) {
  const db = await getDb();
  const [profile] = await db
    .select({
      avatarUrl: user.image,
      displayUsername: user.displayUsername,
      name: user.name,
      username: user.username,
    })
    .from(user)
    .where(and(eq(user.username, username), sql`${user.banned} is not true`))
    .limit(1);

  if (!profile?.username) return null;

  const displayName = profile.displayUsername ?? profile.name;

  return {
    additionalMeta: [{ content: profile.username, property: "profile:username" }],
    description: `Explore album reviews and ratings from ${displayName} (@${profile.username}) on ${siteName}.`,
    image: profile.avatarUrl,
    imageAlt: profile.avatarUrl ? `${displayName}'s profile image` : `${siteName} profile`,
    path: `/user/${encodeURIComponent(profile.username)}`,
    title: createProfilePageTitle(displayName, profile.username),
    type: "profile",
  } satisfies DocumentMetadata;
}

async function resolveReviewDocumentMetadata(reviewId: string) {
  const db = await getDb();
  const [review] = await db
    .select({
      artistNames: albums.artistNames,
      authorDisplayUsername: user.displayUsername,
      authorId: user.id,
      authorUsername: user.username,
      coverUrl: albums.coverUrl,
      rating: reviews.rating,
      title: albums.title,
    })
    .from(reviews)
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(and(eq(reviews.id, reviewId), sql`${user.banned} is not true`))
    .limit(1);

  if (!review) return null;

  const artistNames = review.artistNames.length > 0 ? review.artistNames : ["Unknown Artist"];
  const authorDisplayName = review.authorDisplayUsername ?? review.authorUsername ?? review.authorId;

  return {
    description: `${authorDisplayName} rated ${review.title} by ${artistNames.join(", ")} ${review.rating / 2}/5 on ${siteName}.`,
    image: review.coverUrl,
    imageAlt: review.coverUrl ? `${review.title} album cover` : `${siteName} album review`,
    path: `/review/${encodeURIComponent(reviewId)}`,
    title: createReviewPageTitle(review.title, authorDisplayName),
    type: "article",
  } satisfies DocumentMetadata;
}

function decodePathSegment(value: string | undefined) {
  if (!value) return null;

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
