import { and, count, desc, eq, getTableColumns, ilike, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";
import { getDb } from "@/lib/db";
import { albums, profilePinnedReviews, reviewLikes, reviews, user, userFollows } from "@/lib/db/schema";
import { type FollowableUserRow, getFollowedByViewerSql, mapFollowableUser } from "../followable-user";
import {
  decodeCursor,
  encodeCursor,
  getCreatedAtIdCursorFilter,
  getOptionalCurrentUser,
  getOptionalCurrentUserId,
} from "../server-utils";
import { ensureAlbumExistsForWrite, getMissingAlbumMetadataForWrite } from "./album-service";
import { createReviewLikedNotification } from "./notification-service";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "../auth-middleware";

// Constants

const ratingBuckets: readonly ["1", "2", "3", "4", "5"] = ["1", "2", "3", "4", "5"];
const maxProfilePinnedReviews = 3;
const maxReviewShareCodeAttempts = 5;
const reviewLikesPageSize = 24;
const reviewShareCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const reviewShareCodeLength = 10;
const reviewsPageSize = 12;
const userSearchResultLimit = 5;

// Schemas

const albumReviewsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

const reviewLikesCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().trim().min(1).max(128),
});

// Types

interface AlbumReviewsCursorPayload {
  createdAt: string;
  id: string;
}

interface ReviewLikesCursorPayload {
  createdAt: string;
  id: string;
}

export interface AlbumReviewsPage {
  nextCursor: string | null;
  reviews: ReturnType<typeof mapAlbumReview>[];
}

export interface ReviewLikesPage {
  nextCursor: string | null;
  users: ReturnType<typeof mapFollowableUser>[];
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

export interface ReviewCodeInput extends AlbumIdInput {
  reviewCode: string;
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

export interface ReviewLikesInput extends DeleteReviewInput {
  cursor?: string;
}

export interface ProfilePinnedReviewInput {
  reviewId: string;
}

// Services

export async function getAlbumReviewsService(data: AlbumReviewsInput): Promise<AlbumReviewsPage> {
  const db = await getDb();
  const viewerUserId = await getOptionalCurrentUserId(db);
  const cursor = data.cursor ? decodeReviewsCursor(data.cursor) : undefined;
  const likedByViewer = viewerUserId
    ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
    : sql<boolean>`false`;
  const canDelete = viewerUserId ? sql<boolean>`${reviews.userId} = ${viewerUserId}` : sql<boolean>`false`;
  const cursorFilter = cursor ? getAlbumReviewsCursorFilter(cursor) : undefined;
  const albumReviewSelect = {
    canDelete,
    liked: likedByViewer,
    likes: getVisibleReviewLikeCountSql(reviews.id),
    review: getTableColumns(reviews),
    user: {
      avatarUrl: user.image,
      displayUsername: user.displayUsername,
      id: user.id,
      username: user.username,
    },
  };
  const pinnedReviewRows =
    viewerUserId && !cursor
      ? await db
          .select(albumReviewSelect)
          .from(reviews)
          .innerJoin(user, eq(reviews.userId, user.id))
          .where(and(eq(reviews.albumId, data.albumId), eq(reviews.userId, viewerUserId), getVisibleUserFilter(user)))
          .limit(1)
      : [];
  const reviewFilter = and(
    eq(reviews.albumId, data.albumId),
    getVisibleUserFilter(user),
    cursorFilter,
    viewerUserId ? ne(reviews.userId, viewerUserId) : undefined
  );

  const albumReviews = await db
    .select(albumReviewSelect)
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(reviewFilter)
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
    reviews: [...pinnedReviewRows, ...pageRows].map(mapAlbumReview),
  };
}

export async function getReviewByShareCodeService(data: ReviewCodeInput): Promise<ReviewDetail> {
  const db = await getDb();
  const currentUser = await getOptionalCurrentUser(db);
  const viewerUserId = currentUser?.id;
  const likedByViewer = viewerUserId
    ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
    : sql<boolean>`false`;
  const canDelete = viewerUserId ? sql<boolean>`${reviews.userId} = ${viewerUserId}` : sql<boolean>`false`;
  const authorFilter = currentUser?.isAdmin ? undefined : getVisibleUserFilter(user);

  const [review] = await db
    .select({
      album: getTableColumns(albums),
      liked: likedByViewer,
      likes: getVisibleReviewLikeCountSql(reviews.id),
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
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(and(eq(reviews.albumId, data.albumId), eq(reviews.shareCode, data.reviewCode), authorFilter))
    .limit(1);

  if (!review) {
    throw new Error("Review not found");
  }

  return mapReviewDetail(review);
}

export async function getUserProfileService(data: UserProfileInput): Promise<UserProfile> {
  const db = await getDb();
  const currentUser = await getOptionalCurrentUser(db);
  const viewerUserId = currentUser?.id;
  const profile = await getUserProfileRow(db, data.username, viewerUserId);

  if (!profile) {
    throw new Error("User not found");
  }

  if (profile.banned && !currentUser?.isAdmin) {
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
  const currentUser = await getOptionalCurrentUser(db);
  const normalizedQuery = data.query.toLowerCase();
  const escapedQuery = escapeLikePattern(data.query);
  const containsPattern = `%${escapedQuery}%`;
  const prefixPattern = `${escapedQuery}%`;
  const visibilityFilter = currentUser?.isAdmin ? undefined : getVisibleUserFilter(user);

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
        visibilityFilter,
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
  const currentUser = await getOptionalCurrentUser(db);
  const viewerUserId = currentUser?.id;
  const canDelete = viewerUserId === data.userId;
  const likedByViewer = viewerUserId
    ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
    : sql<boolean>`false`;
  const cursor = data.cursor ? decodeReviewsCursor(data.cursor) : undefined;
  const cursorFilter = cursor ? getAlbumReviewsCursorFilter(cursor) : undefined;
  const authorFilter = currentUser?.isAdmin ? undefined : getVisibleUserFilter(user);

  const pinnedByProfile = sql<boolean>`${profilePinnedReviews.reviewId} is not null`;
  const pinnedSort = cursor
    ? sql<number>`1`
    : sql<number>`case when ${profilePinnedReviews.reviewId} is not null then 0 else 1 end`;
  const reviewFilter = and(
    eq(reviews.userId, data.userId),
    authorFilter,
    cursorFilter,
    cursor ? sql`${profilePinnedReviews.reviewId} is null` : undefined
  );

  const userReviews = await db
    .select({
      album: getTableColumns(albums),
      liked: likedByViewer,
      likes: getVisibleReviewLikeCountSql(reviews.id),
      pinned: pinnedByProfile,
      review: getTableColumns(reviews),
    })
    .from(reviews)
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .innerJoin(user, eq(reviews.userId, user.id))
    .leftJoin(
      profilePinnedReviews,
      and(eq(profilePinnedReviews.userId, data.userId), eq(profilePinnedReviews.reviewId, reviews.id))
    )
    .where(reviewFilter)
    .orderBy(pinnedSort, desc(reviews.createdAt), desc(reviews.id))
    .limit(reviewsPageSize + (cursor ? 1 : maxProfilePinnedReviews + 1));

  const pinnedRows = cursor ? [] : userReviews.filter((row) => row.pinned);
  const normalRows = userReviews.filter((row) => !row.pinned);
  const hasNextPage = normalRows.length > reviewsPageSize;
  const pageRows = hasNextPage ? normalRows.slice(0, reviewsPageSize) : normalRows;
  const lastReview = pageRows.at(-1)?.review;

  return {
    nextCursor:
      hasNextPage && lastReview
        ? encodeCursor({
            createdAt: lastReview.createdAt.toISOString(),
            id: lastReview.id,
          })
        : null,
    reviews: [
      ...pinnedRows.map((row) => mapUserReview(row, canDelete)),
      ...pageRows.map((row) => mapUserReview(row, canDelete)),
    ],
  };
}

export async function getReviewLikesService(data: ReviewLikesInput): Promise<ReviewLikesPage> {
  const db = await getDb();
  const currentUser = await getOptionalCurrentUser(db);
  const viewerUserId = currentUser?.id;
  const reviewAuthorFilter = currentUser?.isAdmin ? undefined : getVisibleUserFilter(user);
  const [targetReview] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(and(eq(reviews.id, data.reviewId), reviewAuthorFilter))
    .limit(1);

  if (!targetReview) {
    throw new Error("Review not found");
  }

  const cursor = data.cursor ? decodeReviewLikesCursor(data.cursor) : undefined;
  const cursorFilter = cursor ? getReviewLikesCursorFilter(cursor) : undefined;
  const likedUser = alias(user, "liked_user");
  const likedUserId = sql.raw('"liked_user"."id"');
  const followedByViewer = getFollowedByViewerSql(viewerUserId, likedUserId);
  const reviewLikeSelect = {
    followedByViewer,
    likeCreatedAt: reviewLikes.createdAt,
    user: {
      avatarUrl: likedUser.image,
      displayUsername: likedUser.displayUsername,
      id: likedUser.id,
      name: likedUser.name,
      username: likedUser.username,
    },
  };
  const pinnedLikeRows =
    viewerUserId && !cursor
      ? await db
          .select(reviewLikeSelect)
          .from(reviewLikes)
          .innerJoin(likedUser, eq(reviewLikes.userId, likedUser.id))
          .where(
            and(
              eq(reviewLikes.reviewId, data.reviewId),
              eq(reviewLikes.userId, viewerUserId),
              isNotNull(likedUser.username),
              sql`${likedUser.banned} is not true`
            )
          )
          .limit(1)
      : [];

  const likeRows = await db
    .select(reviewLikeSelect)
    .from(reviewLikes)
    .innerJoin(likedUser, eq(reviewLikes.userId, likedUser.id))
    .where(
      and(
        eq(reviewLikes.reviewId, data.reviewId),
        isNotNull(likedUser.username),
        sql`${likedUser.banned} is not true`,
        viewerUserId ? ne(reviewLikes.userId, viewerUserId) : undefined,
        cursorFilter ?? undefined
      )
    )
    .orderBy(desc(reviewLikes.createdAt), desc(reviewLikes.userId))
    .limit(reviewLikesPageSize + 1);

  return mapReviewLikesPage(likeRows, pinnedLikeRows);
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
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(and(eq(reviews.albumId, albumId), getVisibleUserFilter(user)));

  const distribution = await db
    .select({
      count: count(reviews.id),
      rating: ratingBucket,
    })
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(and(eq(reviews.albumId, albumId), getVisibleUserFilter(user)))
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

  for (let attempt = 0; attempt < maxReviewShareCodeAttempts; attempt++) {
    try {
      return await context.db.transaction(async (transaction) => {
        await ensureAlbumExistsForWrite(albumMetadata, transaction);

        const [review] = await transaction
          .insert(reviews)
          .values({
            albumId: data.albumId,
            body: data.body || null,
            rating: data.rating,
            shareCode: generateReviewShareCode(),
            userId: context.user.id,
          })
          .returning();

        return review;
      });
    } catch (error) {
      if (isShareCodeUniqueViolation(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Could not create review share code");
}

export async function deleteReviewService(data: DeleteReviewInput, context: AuthenticatedContext) {
  const ownershipFilter = !context.user.isAdmin && eq(reviews.userId, context.user.id);
  const conditions = and(eq(reviews.id, data.reviewId), ownershipFilter || undefined);

  const [deletedReview] = await context.db
    .delete(reviews)
    .where(conditions)
    .returning({ albumId: reviews.albumId, id: reviews.id });

  if (!deletedReview) {
    throw new Error("Review not found");
  }

  return deletedReview;
}

export async function pinProfileReviewService(data: ProfilePinnedReviewInput, context: AuthenticatedContext) {
  return await context.db.transaction(async (transaction) => {
    await transaction.execute(sql`select 1 from ${user} where ${user.id} = ${context.user.id} for update`);

    const [targetReview] = await transaction
      .select({ userId: reviews.userId })
      .from(reviews)
      .where(eq(reviews.id, data.reviewId))
      .limit(1);

    if (!targetReview) {
      throw new Error("Review not found");
    }

    if (targetReview.userId !== context.user.id) {
      throw new Error("You can only pin your own reviews");
    }

    const [existingPin] = await transaction
      .select({ reviewId: profilePinnedReviews.reviewId })
      .from(profilePinnedReviews)
      .where(and(eq(profilePinnedReviews.userId, context.user.id), eq(profilePinnedReviews.reviewId, data.reviewId)))
      .limit(1);

    if (existingPin) {
      return { pinned: true, reviewId: data.reviewId };
    }

    const [pinCount] = await transaction
      .select({ count: count(profilePinnedReviews.reviewId) })
      .from(profilePinnedReviews)
      .where(eq(profilePinnedReviews.userId, context.user.id));

    if ((pinCount?.count ?? 0) >= maxProfilePinnedReviews) {
      throw new Error("You can pin up to 3 reviews.");
    }

    await transaction.insert(profilePinnedReviews).values({ reviewId: data.reviewId, userId: context.user.id });

    return { pinned: true, reviewId: data.reviewId };
  });
}

export async function unpinProfileReviewService(data: ProfilePinnedReviewInput, context: AuthenticatedContext) {
  await context.db
    .delete(profilePinnedReviews)
    .where(and(eq(profilePinnedReviews.userId, context.user.id), eq(profilePinnedReviews.reviewId, data.reviewId)));

  return { pinned: false, reviewId: data.reviewId };
}

export async function setReviewLikeService(data: ReviewLikeInput, context: AuthenticatedContext) {
  await assertReviewIsLikeable(data.reviewId, context);

  if (data.liked) {
    await context.db.transaction(async (transaction) => {
      const [insertedLike] = await transaction
        .insert(reviewLikes)
        .values({ reviewId: data.reviewId, userId: context.user.id })
        .onConflictDoNothing()
        .returning({ reviewId: reviewLikes.reviewId });

      if (insertedLike) {
        const notificationData = { actorUserId: context.user.id, reviewId: data.reviewId };
        await createReviewLikedNotification(notificationData, transaction);
      }
    });
  } else {
    await context.db
      .delete(reviewLikes)
      .where(and(eq(reviewLikes.reviewId, data.reviewId), eq(reviewLikes.userId, context.user.id)));
  }

  const [likeCount] = await context.db
    .select({ likes: count(reviewLikes.reviewId) })
    .from(reviewLikes)
    .innerJoin(user, eq(reviewLikes.userId, user.id))
    .where(and(eq(reviewLikes.reviewId, data.reviewId), getVisibleUserFilter(user)));

  return { liked: data.liked, likes: likeCount?.likes ?? 0, reviewId: data.reviewId };
}

// Helpers

async function assertReviewIsLikeable(reviewId: string, context: AuthenticatedContext) {
  const authorFilter = context.user.isAdmin ? undefined : getVisibleUserFilter(user);
  const [targetReview] = await context.db
    .select({ id: reviews.id })
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(and(eq(reviews.id, reviewId), authorFilter))
    .limit(1);

  if (!targetReview) {
    throw new Error("Review not found");
  }
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
      banned: profileUser.banned,
      displayUsername: profileUser.displayUsername,
      followedByViewer,
      followersCount: sql<number>`(
        select count(*)::int
        from ${userFollows}
        where ${userFollows.followingId} = ${profileUserId}
          and exists(
            select 1 from ${user}
            where ${user.id} = ${userFollows.followerId}
              and ${user.banned} is not true
          )
      )`,
      followingCount: sql<number>`(
        select count(*)::int
        from ${userFollows}
        where ${userFollows.followerId} = ${profileUserId}
          and exists(
            select 1 from ${user}
            where ${user.id} = ${userFollows.followingId}
              and ${user.banned} is not true
          )
      )`,
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

function getVisibleReviewLikeCountSql(reviewId: typeof reviews.id) {
  return sql<number>`(
    select count(*)::int
    from ${reviewLikes}
    where ${reviewLikes.reviewId} = ${reviewId}
      and exists(
        select 1 from ${user}
        where ${user.id} = ${reviewLikes.userId}
          and ${user.banned} is not true
      )
  )`;
}

function getVisibleUserFilter(userTable: { banned: typeof user.banned }) {
  return sql`${userTable.banned} is not true`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function generateReviewShareCode() {
  const code: string[] = [];

  while (code.length < reviewShareCodeLength) {
    const bytes = new Uint8Array(reviewShareCodeLength);
    globalThis.crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= 232) continue;

      code.push(reviewShareCodeAlphabet[byte % reviewShareCodeAlphabet.length]);

      if (code.length === reviewShareCodeLength) break;
    }
  }

  return code.join("");
}

function isShareCodeUniqueViolation(error: unknown) {
  if (!(error && typeof error === "object")) return false;

  const dbError = error as { code?: unknown; constraint?: unknown; constraint_name?: unknown; message?: unknown };
  const constraintName = dbError.constraint_name ?? dbError.constraint;

  return (
    dbError.code === "23505" &&
    (constraintName === "reviews_share_code_unique_idx" ||
      (typeof dbError.message === "string" && dbError.message.includes("reviews_share_code_unique_idx")))
  );
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

interface ReviewDetailRow extends AlbumReviewRow {
  album: typeof albums.$inferSelect;
}

interface UserProfileRow {
  avatarObjectKey: string | null;
  avatarUrl: string | null;
  banned: boolean | null;
  displayUsername: string | null;
  followedByViewer: boolean;
  followersCount: number;
  followingCount: number;
  id: string;
  name: string;
  reviewCount: number;
  username: string | null;
}

interface ReviewLikeUserRow extends FollowableUserRow {
  likeCreatedAt: Date;
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
  pinned: boolean;
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
    shareCode: review.shareCode,
    createdAt: review.createdAt,
    user: {
      avatarUrl: user.avatarUrl ?? undefined,
      displayUsername: user.displayUsername ?? user.username ?? user.id,
      username: user.username ?? undefined,
    },
  };
}

type ReviewDetail = ReturnType<typeof mapReviewDetail>;

function mapReviewDetail(row: ReviewDetailRow) {
  const albumReview = mapAlbumReview(row);

  return {
    ...albumReview,
    album: {
      artist: row.album.artistNames.join(", "),
      coverUrl: row.album.coverUrl ?? undefined,
      id: row.album.id,
      title: row.album.title,
      year: row.album.releaseDate.slice(0, 4),
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
    banned: userProfile.banned ?? false,
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

function mapUserReview({ album, liked, likes, pinned, review }: UserReviewRow, canDelete: boolean) {
  return {
    album: {
      artist: album.artistNames.join(", "),
      coverUrl: album.coverUrl ?? undefined,
      id: album.id,
      title: album.title,
      year: album.releaseDate.slice(0, 4),
    },
    canDelete,
    createdAt: review.createdAt,
    id: review.id,
    liked,
    likes,
    pinned,
    rating: review.rating / 2,
    review: review.body ?? undefined,
    shareCode: review.shareCode,
  };
}

function mapReviewLikesPage(rows: ReviewLikeUserRow[], pinnedRows: ReviewLikeUserRow[] = []): ReviewLikesPage {
  const hasNextPage = rows.length > reviewLikesPageSize;
  const pageRows = hasNextPage ? rows.slice(0, reviewLikesPageSize) : rows;
  const lastRow = pageRows.at(-1);

  return {
    nextCursor:
      hasNextPage && lastRow
        ? encodeCursor({
            createdAt: lastRow.likeCreatedAt.toISOString(),
            id: lastRow.user.id,
          })
        : null,
    users: [...pinnedRows, ...pageRows].map(mapFollowableUser),
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

function getReviewLikesCursorFilter(cursor: ReviewLikesCursorPayload) {
  return getCreatedAtIdCursorFilter(cursor, { createdAt: reviewLikes.createdAt, id: reviewLikes.userId });
}

function decodeReviewLikesCursor(cursor: string): ReviewLikesCursorPayload {
  return decodeCursor(cursor, reviewLikesCursorPayloadSchema, "Invalid review likes cursor");
}
