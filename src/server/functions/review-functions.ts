import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, desc, eq, getTableColumns, lt, or, sql } from "drizzle-orm";
import z from "zod";
import { createAuth } from "@/lib/auth";
import { createDbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { authMiddleware } from "../auth-middleware";
import type { AuthenticatedContext } from "../auth-middleware";

const ratingBuckets = ["1", "2", "3", "4", "5"] as const;

const albumIdSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
});

const albumReviewsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

const albumReviewsSchema = albumIdSchema.extend({
  cursor: z.string().trim().min(1).optional(),
});

const reviewLikeSchema = z.object({
  liked: z.boolean(),
  reviewId: z.uuid(),
});

const deleteReviewSchema = z.object({
  reviewId: z.uuid(),
});

const createReviewSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
  body: z.string().trim().max(2000).optional(),
  rating: z.number().int().min(1).max(10),
});

const albumReviewsPageSize = 12;
const base64PaddingPattern = /=+$/;

// --- Types ---

interface AlbumReviewsCursorPayload {
  createdAt: string;
  id: string;
}

interface AlbumReviewsInput {
  albumId: string;
  cursor?: string;
}

export interface AlbumReviewsPage {
  nextCursor: string | null;
  reviews: ReturnType<typeof mapAlbumReview>[];
}

async function getAlbumReviewsHandler(data: AlbumReviewsInput): Promise<AlbumReviewsPage> {
  const { client, db } = createDbClient();

  try {
    const viewerUserId = await getCurrentUserId(db);
    const likedByViewer = viewerUserId
      ? sql<boolean>`exists(select 1 from ${schema.reviewLikes} where ${schema.reviewLikes.reviewId} = ${schema.reviews.id} and ${schema.reviewLikes.userId} = ${viewerUserId})`
      : sql<boolean>`false`;
    const canDelete = viewerUserId ? sql<boolean>`${schema.reviews.userId} = ${viewerUserId}` : sql<boolean>`false`;
    const cursor = data.cursor ? decodeAlbumReviewsCursor(data.cursor) : undefined;
    const cursorFilter = cursor ? getAlbumReviewsCursorFilter(cursor) : undefined;

    const albumReviews = await db
      .select({
        liked: likedByViewer,
        likes: sql<number>`(select count(*)::int from ${schema.reviewLikes} where ${schema.reviewLikes.reviewId} = ${schema.reviews.id})`,
        canDelete,
        review: getTableColumns(schema.reviews),
        user: {
          avatarUrl: schema.user.image,
          displayUsername: schema.user.displayUsername,
          id: schema.user.id,
          name: schema.user.name,
          username: schema.user.username,
        },
      })
      .from(schema.reviews)
      .innerJoin(schema.user, eq(schema.reviews.userId, schema.user.id))
      .where(
        cursorFilter
          ? and(eq(schema.reviews.albumId, data.albumId), cursorFilter)
          : eq(schema.reviews.albumId, data.albumId)
      )
      .orderBy(desc(schema.reviews.createdAt), desc(schema.reviews.id))
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

async function getAlbumRatingSummaryHandler({ albumId }: z.infer<typeof albumIdSchema>) {
  const { client, db } = createDbClient();
  const ratingBucket = sql<number>`least(5, greatest(1, ceil(${schema.reviews.rating}::numeric / 2)))::integer`;

  try {
    const [summary] = await db
      .select({
        average: sql<number | null>`(avg(${schema.reviews.rating}) / 2)::float`,
        total: count(schema.reviews.id),
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.albumId, albumId));

    const distribution = await db
      .select({
        count: count(schema.reviews.id),
        rating: ratingBucket,
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.albumId, albumId))
      .groupBy(ratingBucket);

    return mapAlbumRatingSummary(summary, distribution);
  } finally {
    await client.end({ timeout: 1 }).catch(() => undefined);
  }
}

async function hasMyAlbumReviewHandler(data: z.infer<typeof albumIdSchema>, context: AuthenticatedContext) {
  const [review] = await context.db
    .select({ id: schema.reviews.id })
    .from(schema.reviews)
    .where(and(eq(schema.reviews.albumId, data.albumId), eq(schema.reviews.userId, context.user.id)))
    .limit(1);

  return Boolean(review);
}

async function createReviewHandler(data: z.infer<typeof createReviewSchema>, context: AuthenticatedContext) {
  const [review] = await context.db
    .insert(schema.reviews)
    .values({
      albumId: data.albumId,
      body: data.body || null,
      rating: data.rating,
      userId: context.user.id,
    })
    .returning();

  return review;
}

async function deleteReviewHandler(data: z.infer<typeof deleteReviewSchema>, context: AuthenticatedContext) {
  const [deletedReview] = await context.db
    .delete(schema.reviews)
    .where(and(eq(schema.reviews.id, data.reviewId), eq(schema.reviews.userId, context.user.id)))
    .returning({ albumId: schema.reviews.albumId, id: schema.reviews.id });

  if (!deletedReview) {
    throw new Error("Review not found");
  }

  return deletedReview;
}

async function setReviewLikeHandler(data: z.infer<typeof reviewLikeSchema>, context: AuthenticatedContext) {
  if (data.liked) {
    await context.db
      .insert(schema.reviewLikes)
      .values({ reviewId: data.reviewId, userId: context.user.id })
      .onConflictDoNothing();
  } else {
    await context.db
      .delete(schema.reviewLikes)
      .where(and(eq(schema.reviewLikes.reviewId, data.reviewId), eq(schema.reviewLikes.userId, context.user.id)));
  }

  const [likeCount] = await context.db
    .select({ likes: count(schema.reviewLikes.reviewId) })
    .from(schema.reviewLikes)
    .where(eq(schema.reviewLikes.reviewId, data.reviewId));

  return { liked: data.liked, likes: likeCount?.likes ?? 0, reviewId: data.reviewId };
}

export const createReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createReviewSchema)
  .handler(({ context, data }) => createReviewHandler(data, context));

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(deleteReviewSchema)
  .handler(({ context, data }) => deleteReviewHandler(data, context));

export const getAlbumReviews = createServerFn()
  .validator(albumReviewsSchema)
  .handler(({ data }) => getAlbumReviewsHandler(data));

export const getAlbumRatingSummary = createServerFn()
  .validator(albumIdSchema)
  .handler(({ data }) => getAlbumRatingSummaryHandler(data));

export const hasMyAlbumReview = createServerFn()
  .middleware([authMiddleware])
  .validator(albumIdSchema)
  .handler(({ context, data }) => hasMyAlbumReviewHandler(data, context));

export const setReviewLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(reviewLikeSchema)
  .handler(({ context, data }) => setReviewLikeHandler(data, context));

// --- Helpers ---

interface AlbumReviewRow {
  canDelete: boolean;
  liked: boolean;
  likes: number;
  review: typeof schema.reviews.$inferSelect;
  user: {
    avatarUrl: string | null;
    displayUsername: string | null;
    id: string;
    name: string;
    username: string | null;
  };
}

async function getCurrentUserId(db: ReturnType<typeof createDbClient>["db"]) {
  const auth = createAuth(db);
  const session = await auth.api.getSession({ headers: getRequestHeaders() }).catch(() => null);

  return session?.user.id;
}

interface AlbumRatingSummaryRow {
  average: number | null;
  total: number;
}

interface RatingDistributionRow {
  count: number;
  rating: number;
}

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

function formatRatingTotal(total: number) {
  const countLabel = total === 1 ? "rating" : "ratings";

  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(total % 1_000_000 === 0 ? 0 : 1)}M ${countLabel}`;
  if (total >= 1000) return `${(total / 1000).toFixed(total % 1000 === 0 ? 0 : 1)}k ${countLabel}`;

  return `${total} ${countLabel}`;
}

function getAlbumReviewsCursorFilter(cursor: AlbumReviewsCursorPayload) {
  const cursorCreatedAt = new Date(cursor.createdAt);

  return or(
    lt(schema.reviews.createdAt, cursorCreatedAt),
    and(eq(schema.reviews.createdAt, cursorCreatedAt), lt(schema.reviews.id, cursor.id))
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
