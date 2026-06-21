import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import z from "zod";
import { createDbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { authMiddleware } from "../auth-middleware";
import type { AuthenticatedContext } from "../auth-middleware";

const ratingBuckets = ["1", "2", "3", "4", "5"] as const;

const albumIdSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
});

const createReviewSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
  body: z.string().trim().max(2000).optional(),
  rating: z.number().int().min(1).max(10),
});

async function getAlbumReviewsHandler({ albumId }: z.infer<typeof albumIdSchema>) {
  const { client, db } = createDbClient();

  try {
    const albumReviews = await db
      .select({
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
      .where(eq(schema.reviews.albumId, albumId))
      .orderBy(desc(schema.reviews.createdAt));

    return albumReviews.map(mapAlbumReview);
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

export const createReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createReviewSchema)
  .handler(({ context, data }) => createReviewHandler(data, context));

export const getAlbumReviews = createServerFn()
  .validator(albumIdSchema)
  .handler(({ data }) => getAlbumReviewsHandler(data));

export const getAlbumRatingSummary = createServerFn()
  .validator(albumIdSchema)
  .handler(({ data }) => getAlbumRatingSummaryHandler(data));

export const hasMyAlbumReview = createServerFn()
  .middleware([authMiddleware])
  .validator(albumIdSchema)
  .handler(({ context, data }) => hasMyAlbumReviewHandler(data, context));

// --- Helpers ---

interface AlbumReviewRow {
  review: typeof schema.reviews.$inferSelect;
  user: {
    avatarUrl: string | null;
    displayUsername: string | null;
    id: string;
    name: string;
    username: string | null;
  };
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

function mapAlbumReview({ review, user }: AlbumReviewRow) {
  return {
    id: review.id,
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
