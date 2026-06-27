import { and, count, desc, eq, getTableColumns, ilike, isNotNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";
import { getDb } from "@/lib/db";
import { albums, reviewLikes, reviews, user, userFollows } from "@/lib/db/schema";
import { decodeCursor, encodeCursor, getOptionalCurrentUserId } from "../server-utils";
import { ensureAlbumExistsForWrite, getMissingAlbumMetadataForWrite } from "./album-service";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "../auth-middleware";

// Constants

const ratingBuckets: readonly ["1", "2", "3", "4", "5"] = ["1", "2", "3", "4", "5"];
const reviewsPageSize = 12;
const userSearchResultLimit = 5;

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
  followersCount: number;
  followingCount: number;
  reviewCount: number;
  user: ReturnType<typeof mapUserProfile>;
}

export interface UserProfileInput {
  username: string;
}

export interface UserSearchInput {
  query: string;
}

export interface UserSearchResult {
  avatarUrl?: string;
  displayUsername?: string;
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
  const db = await getDb();
  const viewerUserId = await getOptionalCurrentUserId(db);
  const likedByViewer = viewerUserId
    ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
    : sql<boolean>`false`;
  const canDelete = viewerUserId ? sql<boolean>`${reviews.userId} = ${viewerUserId}` : sql<boolean>`false`;
  const cursor = data.cursor ? decodeReviewsCursor(data.cursor) : undefined;
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
        username: user.username,
      },
    })
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(cursorFilter ? and(eq(reviews.albumId, data.albumId), cursorFilter) : eq(reviews.albumId, data.albumId))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(reviewsPageSize + 1);

  const hasNextPage = albumReviews.length > reviewsPageSize;
  const pageRows = hasNextPage ? albumReviews.slice(0, reviewsPageSize) : albumReviews;
  const lastReview = pageRows.at(-1)?.review;

  return {
    nextCursor:
      hasNextPage && lastReview
        ? encodeCursor({
            createdAt: lastReview.createdAt.toISOString(),
            id: lastReview.id,
          })
        : null,
    reviews: pageRows.map(mapAlbumReview),
  };
}

export async function getUserProfileService(data: UserProfileInput): Promise<UserProfile> {
  const db = await getDb();
  const viewerUserId = await getOptionalCurrentUserId(db);
  const profile = await getUserProfileRow(db, data.username, viewerUserId);

  if (!profile) {
    throw new Error("User not found");
  }

  return {
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
    reviewCount: profile.reviewCount,
    user: mapUserProfile(profile, {
      canEdit: viewerUserId === profile.id,
      followedByViewer: profile.followedByViewer,
    }),
  };
}

export async function searchUsersService(data: UserSearchInput): Promise<UserSearchResult[]> {
  const db = await getDb();
  const normalizedQuery = data.query.toLowerCase();
  const escapedQuery = escapeLikePattern(data.query);
  const containsPattern = `%${escapedQuery}%`;
  const prefixPattern = `${escapedQuery}%`;

  const userRows = await db
    .select({
      avatarUrl: user.image,
      displayUsername: user.displayUsername,
      username: user.username,
    })
    .from(user)
    .where(
      and(
        isNotNull(user.username),
        or(ilike(user.username, containsPattern), ilike(user.displayUsername, containsPattern))
      )
    )
    .orderBy(
      sql<number>`case
        when lower(${user.username}) = ${normalizedQuery} then 0
        when ${user.username} ilike ${prefixPattern} then 1
        when ${user.displayUsername} ilike ${prefixPattern} then 2
        else 3
      end`,
      user.username
    )
    .limit(userSearchResultLimit);

  return userRows.flatMap(mapUserSearchResult);
}

export async function getUserReviewsService(data: UserReviewsInput): Promise<UserReviewsPage> {
  const db = await getDb();
  const viewerUserId = await getOptionalCurrentUserId(db);
  const canDelete = viewerUserId === data.userId;
  const likedByViewer = viewerUserId
    ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
    : sql<boolean>`false`;
  const cursor = data.cursor ? decodeReviewsCursor(data.cursor) : undefined;
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
    .limit(reviewsPageSize + 1);

  const hasNextPage = userReviews.length > reviewsPageSize;
  const pageRows = hasNextPage ? userReviews.slice(0, reviewsPageSize) : userReviews;
  const lastReview = pageRows.at(-1)?.review;

  return {
    nextCursor:
      hasNextPage && lastReview
        ? encodeCursor({
            createdAt: lastReview.createdAt.toISOString(),
            id: lastReview.id,
          })
        : null,
    reviews: pageRows.map((row) => mapUserReview(row, canDelete)),
  };
}

export async function getAlbumRatingSummaryService({ albumId }: AlbumIdInput) {
  const db = await getDb();
  const ratingBucket = sql<number>`least(5, greatest(1, ceil(${reviews.rating}::numeric / 2)))::integer`;

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

function getUserProfileRow(db: Db, username: string, viewerUserId?: string) {
  const profileUser = alias(user, "profile_user");
  const profileUserId = sql.raw('"profile_user"."id"');
  const followedByViewer = viewerUserId
    ? sql<boolean>`exists(select 1 from ${userFollows} where ${userFollows.followerId} = ${viewerUserId} and ${userFollows.followingId} = ${profileUserId})`
    : sql<boolean>`false`;

  return db
    .select({
      avatarObjectKey: profileUser.avatarObjectKey,
      avatarUrl: profileUser.image,
      displayUsername: profileUser.displayUsername,
      followedByViewer,
      followersCount: sql<number>`(select count(*)::int from ${userFollows} where ${userFollows.followingId} = ${profileUserId})`,
      followingCount: sql<number>`(select count(*)::int from ${userFollows} where ${userFollows.followerId} = ${profileUserId})`,
      id: profileUser.id,
      name: profileUser.name,
      reviewCount: sql<number>`(select count(*)::int from ${reviews} where ${reviews.userId} = ${profileUserId})`,
      username: profileUser.username,
    })
    .from(profileUser)
    .where(eq(profileUser.username, username))
    .limit(1)
    .then((rows) => rows[0]);
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
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
    username: string | null;
  };
}

interface UserProfileRow {
  avatarObjectKey: string | null;
  avatarUrl: string | null;
  displayUsername: string | null;
  followedByViewer: boolean;
  followersCount: number;
  followingCount: number;
  id: string;
  name: string;
  reviewCount: number;
  username: string | null;
}

interface UserSearchRow {
  avatarUrl: string | null;
  displayUsername: string | null;
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
      displayUsername: user.displayUsername ?? user.username ?? user.id,
      username: user.username ?? undefined,
    },
  };
}

function mapUserProfile(
  userProfile: UserProfileRow,
  { canEdit, followedByViewer }: { canEdit: boolean; followedByViewer: boolean }
) {
  return {
    avatarObjectKey: canEdit ? (userProfile.avatarObjectKey ?? undefined) : undefined,
    avatarUrl: userProfile.avatarUrl ?? undefined,
    canEdit,
    displayName: userProfile.displayUsername ?? userProfile.name,
    displayUsername: userProfile.displayUsername ?? userProfile.username ?? userProfile.id,
    followedByViewer,
    id: userProfile.id,
    username: userProfile.username ?? userProfile.id,
  };
}

function mapUserSearchResult(userRow: UserSearchRow) {
  if (!userRow.username) {
    return [];
  }

  return [
    {
      avatarUrl: userRow.avatarUrl ?? undefined,
      displayUsername: userRow.displayUsername ?? undefined,
      username: userRow.username,
    },
  ];
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

function decodeReviewsCursor(cursor: string): AlbumReviewsCursorPayload {
  return decodeCursor(cursor, albumReviewsCursorPayloadSchema, "Invalid reviews cursor");
}
