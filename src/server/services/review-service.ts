import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, desc, eq, getTableColumns, lt, or, sql } from "drizzle-orm";
import z from "zod";
import { createAuth } from "@/lib/auth";
import { createDbClient } from "@/lib/db";
import { albums, reviewLikes, reviews, user } from "@/lib/db/schema";
import { ensureAlbumExistsForWrite, getMissingAlbumMetadataForWrite } from "./album-service";
import type { AuthenticatedContext } from "../auth-middleware";

// Constants

const ratingBuckets: readonly ["1", "2", "3", "4", "5"] = ["1", "2", "3", "4", "5"];
const albumReviewsPageSize = 12;
const base64PaddingPattern = /=+$/;

// Schemas

const albumReviewsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

// Types

interface AlbumReviewsCursorPayload {
  createdAt: string;
  id: string;
}

export interface AlbumReviewsPage {
  nextCursor: string | null;
  reviews: ReturnType<typeof mapAlbumReview>[];
}

export interface UserReviewsPage {
  nextCursor: string | null;
  reviews: ReturnType<typeof mapUserReview>[];
}

export interface UserProfile {
  reviewCount: number;
  user: ReturnType<typeof mapUserProfile>;
}

export interface UserProfileInput {
  username: string;
}

export interface AlbumIdInput {
  albumId: string;
}

export interface AlbumReviewsInput extends AlbumIdInput {
  cursor?: string;
}

export interface UserReviewsInput {
  cursor?: string;
  userId: string;
}

export interface CreateReviewInput extends AlbumIdInput {
  body?: string;
  rating: number;
}

export interface DeleteReviewInput {
  reviewId: string;
}

export interface ReviewLikeInput extends DeleteReviewInput {
  liked: boolean;
}

// Services

export async function getAlbumReviewsService(data: AlbumReviewsInput): Promise<AlbumReviewsPage> {
  const { client, db } = createDbClient();

  try {
    const viewerUserId = await getCurrentUserId(db);
    const likedByViewer = viewerUserId
      ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
      : sql<boolean>`false`;
    const canDelete = viewerUserId ? sql<boolean>`${reviews.userId} = ${viewerUserId}` : sql<boolean>`false`;
    const cursor = data.cursor ? decodeAlbumReviewsCursor(data.cursor) : undefined;
    const cursorFilter = cursor ? getAlbumReviewsCursorFilter(cursor) : undefined;

    const albumReviews = await db
      .select({
        liked: likedByViewer,
        likes: sql<number>`(select count(*)::int from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id})`,
        canDelete,
        review: getTableColumns(reviews),
        user: {
          avatarUrl: user.image,
          displayUsername: user.displayUsername,
          id: user.id,
          name: user.name,
          username: user.username,
        },
      })
      .from(reviews)
      .innerJoin(user, eq(reviews.userId, user.id))
      .where(cursorFilter ? and(eq(reviews.albumId, data.albumId), cursorFilter) : eq(reviews.albumId, data.albumId))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(albumReviewsPageSize + 1);

    const hasNextPage = albumReviews.length > albumReviewsPageSize;
    const pageRows = hasNextPage ? albumReviews.slice(0, albumReviewsPageSize) : albumReviews;
    const lastReview = pageRows.at(-1)?.review;

    return {
      nextCursor:
        hasNextPage && lastReview
          ? encodeAlbumReviewsCursor({
              createdAt: lastReview.createdAt.toISOString(),
              id: lastReview.id,
            })
          : null,
      reviews: pageRows.map(mapAlbumReview),
    };
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

export async function getUserProfileService(data: UserProfileInput): Promise<UserProfile> {
  const { client, db } = createDbClient();

  try {
    const profile = await getUserProfileRow(db, data.username);

    if (!profile) {
      throw new Error("User not found");
    }

    const viewerUserId = await getCurrentUserId(db);
    const [reviewCountRow] = await db
      .select({ total: count(reviews.id) })
      .from(reviews)
      .where(eq(reviews.userId, profile.id));

    return {
      reviewCount: reviewCountRow?.total ?? 0,
      user: mapUserProfile(profile, viewerUserId === profile.id),
    };
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

export async function getUserReviewsService(data: UserReviewsInput): Promise<UserReviewsPage> {
  const { client, db } = createDbClient();

  try {
    const viewerUserId = await getCurrentUserId(db);
    const canDelete = viewerUserId === data.userId;
    const likedByViewer = viewerUserId
      ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
      : sql<boolean>`false`;
    const cursor = data.cursor ? decodeAlbumReviewsCursor(data.cursor) : undefined;
    const cursorFilter = cursor ? getAlbumReviewsCursorFilter(cursor) : undefined;

    const userReviews = await db
      .select({
        album: getTableColumns(albums),
        liked: likedByViewer,
        likes: sql<number>`(select count(*)::int from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id})`,
        review: getTableColumns(reviews),
      })
      .from(reviews)
      .innerJoin(albums, eq(reviews.albumId, albums.id))
      .where(cursorFilter ? and(eq(reviews.userId, data.userId), cursorFilter) : eq(reviews.userId, data.userId))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(albumReviewsPageSize + 1);

    const hasNextPage = userReviews.length > albumReviewsPageSize;
    const pageRows = hasNextPage ? userReviews.slice(0, albumReviewsPageSize) : userReviews;
    const lastReview = pageRows.at(-1)?.review;

    return {
      nextCursor:
        hasNextPage && lastReview
          ? encodeAlbumReviewsCursor({
              createdAt: lastReview.createdAt.toISOString(),
              id: lastReview.id,
            })
          : null,
      reviews: pageRows.map((row) => mapUserReview(row, canDelete)),
    };
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

export async function getAlbumRatingSummaryService({ albumId }: AlbumIdInput) {
  const { client, db } = createDbClient();
  const ratingBucket = sql<number>`least(5, greatest(1, ceil(${reviews.rating}::numeric / 2)))::integer`;

  try {
    const [summary] = await db
      .select({
        average: sql<number | null>`(avg(${reviews.rating}) / 2)::float`,
        total: count(reviews.id),
      })
      .from(reviews)
      .where(eq(reviews.albumId, albumId));

    const distribution = await db
      .select({
        count: count(reviews.id),
        rating: ratingBucket,
      })
      .from(reviews)
      .where(eq(reviews.albumId, albumId))
      .groupBy(ratingBucket);

    return mapAlbumRatingSummary(summary, distribution);
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

export async function hasMyAlbumReviewService(data: AlbumIdInput, context: AuthenticatedContext) {
  const [review] = await context.db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.albumId, data.albumId), eq(reviews.userId, context.user.id)))
    .limit(1);

  return Boolean(review);
}

export async function createReviewService(data: CreateReviewInput, context: AuthenticatedContext) {
  const albumMetadata = await getMissingAlbumMetadataForWrite(data.albumId, context.db);

  return await context.db.transaction(async (transaction) => {
    await ensureAlbumExistsForWrite(albumMetadata, transaction);

    const [review] = await transaction
      .insert(reviews)
      .values({
        albumId: data.albumId,
        body: data.body || null,
        rating: data.rating,
        userId: context.user.id,
      })
      .returning();

    return review;
  });
}

export async function deleteReviewService(data: DeleteReviewInput, context: AuthenticatedContext) {
  const [deletedReview] = await context.db
    .delete(reviews)
    .where(and(eq(reviews.id, data.reviewId), eq(reviews.userId, context.user.id)))
    .returning({ albumId: reviews.albumId, id: reviews.id });

  if (!deletedReview) {
    throw new Error("Review not found");
  }

  return deletedReview;
}

export async function setReviewLikeService(data: ReviewLikeInput, context: AuthenticatedContext) {
  if (data.liked) {
    await context.db
      .insert(reviewLikes)
      .values({ reviewId: data.reviewId, userId: context.user.id })
      .onConflictDoNothing();
  } else {
    await context.db
      .delete(reviewLikes)
      .where(and(eq(reviewLikes.reviewId, data.reviewId), eq(reviewLikes.userId, context.user.id)));
  }

  const [likeCount] = await context.db
    .select({ likes: count(reviewLikes.reviewId) })
    .from(reviewLikes)
    .where(eq(reviewLikes.reviewId, data.reviewId));

  return { liked: data.liked, likes: likeCount?.likes ?? 0, reviewId: data.reviewId };
}

function getUserProfileRow(db: ReturnType<typeof createDbClient>["db"], username: string) {
  return db
    .select({
      avatarObjectKey: user.avatarObjectKey,
      avatarUrl: user.image,
      displayUsername: user.displayUsername,
      id: user.id,
      name: user.name,
      username: user.username,
    })
    .from(user)
    .where(eq(user.username, username))
    .limit(1)
    .then((rows) => rows[0]);
}

// Rows

interface AlbumReviewRow {
  canDelete: boolean;
  liked: boolean;
  likes: number;
  review: typeof reviews.$inferSelect;
  user: {
    avatarUrl: string | null;
    displayUsername: string | null;
    id: string;
    name: string;
    username: string | null;
  };
}

interface UserProfileRow {
  avatarObjectKey: string | null;
  avatarUrl: string | null;
  displayUsername: string | null;
  id: string;
  name: string;
  username: string | null;
}

interface UserReviewRow {
  album: typeof albums.$inferSelect;
  liked: boolean;
  likes: number;
  review: typeof reviews.$inferSelect;
}

interface AlbumRatingSummaryRow {
  average: number | null;
  total: number;
}

interface RatingDistributionRow {
  count: number;
  rating: number;
}

// Auth

async function getCurrentUserId(db: ReturnType<typeof createDbClient>["db"]) {
  const auth = createAuth(db);
  const session = await auth.api.getSession({ headers: getRequestHeaders() }).catch(() => null);

  return session?.user.id;
}

// Mappers

function mapAlbumRatingSummary(summary: AlbumRatingSummaryRow | undefined, distributionRows: RatingDistributionRow[]) {
  const ratingDistribution = ratingBuckets.map((rating) => ({ count: 0, rating }));

  for (const row of distributionRows) {
    const index = row.rating - 1;
    const rating = ratingDistribution[index];

    if (rating) {
      rating.count = row.count;
    }
  }

  if (!summary || summary.total === 0 || summary.average === null) {
    return { ratingDistribution, ratingSummary: null };
  }

  return {
    ratingDistribution,
    ratingSummary: {
      average: Number(summary.average.toFixed(1)),
      total: formatRatingTotal(summary.total),
    },
  };
}

function mapAlbumReview({ canDelete, liked, likes, review, user }: AlbumReviewRow) {
  return {
    canDelete,
    id: review.id,
    liked,
    likes,
    rating: review.rating / 2,
    review: review.body ?? undefined,
    createdAt: review.createdAt,
    user: {
      avatarUrl: user.avatarUrl ?? undefined,
      name: user.displayUsername ?? user.name,
      username: user.username ?? user.id,
    },
  };
}

function mapUserProfile(userProfile: UserProfileRow, canEdit: boolean) {
  return {
    avatarObjectKey: canEdit ? (userProfile.avatarObjectKey ?? undefined) : undefined,
    avatarUrl: userProfile.avatarUrl ?? undefined,
    canEdit,
    displayName: userProfile.displayUsername ?? userProfile.name,
    id: userProfile.id,
    username: userProfile.username ?? userProfile.id,
  };
}

function mapUserReview({ album, liked, likes, review }: UserReviewRow, canDelete: boolean) {
  return {
    album: {
      artist: album.artistNames.join(", "),
      coverUrl: album.coverUrl ?? undefined,
      id: album.id,
      title: album.title,
      year: String(album.releaseYear),
    },
    canDelete,
    createdAt: review.createdAt,
    id: review.id,
    liked,
    likes,
    rating: review.rating / 2,
    review: review.body ?? undefined,
  };
}

function formatRatingTotal(total: number) {
  const countLabel = total === 1 ? "rating" : "ratings";

  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(total % 1_000_000 === 0 ? 0 : 1)}M ${countLabel}`;
  if (total >= 1000) return `${(total / 1000).toFixed(total % 1000 === 0 ? 0 : 1)}k ${countLabel}`;

  return `${total} ${countLabel}`;
}

// Cursors

function getAlbumReviewsCursorFilter(cursor: AlbumReviewsCursorPayload) {
  const cursorCreatedAt = new Date(cursor.createdAt);

  return or(
    lt(reviews.createdAt, cursorCreatedAt),
    and(eq(reviews.createdAt, cursorCreatedAt), lt(reviews.id, cursor.id))
  );
}

function encodeAlbumReviewsCursor(cursor: AlbumReviewsCursorPayload) {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(base64PaddingPattern, "");
}

function decodeAlbumReviewsCursor(cursor: string): AlbumReviewsCursorPayload {
  try {
    const base64Cursor = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const paddedCursor = base64Cursor.padEnd(Math.ceil(base64Cursor.length / 4) * 4, "=");
    const parsedCursor: unknown = JSON.parse(atob(paddedCursor));

    return albumReviewsCursorPayloadSchema.parse(parsedCursor);
  } catch {
    throw new Error("Invalid reviews cursor");
  }
}
