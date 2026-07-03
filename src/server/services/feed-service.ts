import { and, desc, eq, getTableColumns, gt, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";
import { getDb } from "@/lib/db";
import { albums, reviewLikes, reviews, user, userFollows } from "@/lib/db/schema";
import { decodeCursor, encodeCursor, getOptionalCurrentUserId } from "../server-utils";
import type { SQL } from "drizzle-orm";
import type { Db } from "@/lib/db";

// Constants

const feedPageSize = 20;
const globalRecentCandidateLimit = 90;
const globalLikedCandidateLimit = 60;
const followedCandidateLimit = 90;
const authenticatedGlobalCandidateLimit = 60;
const feedLookbackDays = 30;
const recentLikeWindowDays = 7;
const maxPerAlbum = 2;
const maxPerAuthor = 2;
const maxRatingOnlyRatio = 0.15;
const maxCursorSeenReviewIds = feedPageSize * 5;

// Source boosts decide how strongly candidate origin matters before item-level scoring.
// Keep these small-ish, usually 0-10, so source can break ties without overpowering recency.
const feedSourceRank = {
  followed: 6, // Higher: followed-user activity survives global/trending competition more often.
  recent: 0, // Baseline source. Raise only if the feed should feel more chronological/global.
  recentLike: 4, // Higher: liked-again reviews resurface more aggressively.
} as const;

// Score weights are product tuning knobs. Start with 0-20 changes; larger jumps usually
// make one signal dominate the feed and should be backed by real usage data.
const feedScoreWeights = {
  body: 8, // Higher: written reviews beat rating-only activity more often. Typical range: 4-14.
  followedAuthor: 18, // Higher: signed-in feeds become more social and less discovery-heavy. Typical range: 8-24.
  like: 2, // Multiplies log(total likes). Higher favors established popular reviews. Typical range: 0.5-4.
  ownAuthor: -12, // More negative keeps signed-in home from becoming the viewer's profile. Typical range: -20 to 0.
  ratingOnly: -6, // More negative hides rating-only activity. Move toward 0 to show more ratings. Typical range: -12 to 0.
  recentLike: 8, // Multiplies log(recent likes). Higher makes old reviews resurface from fresh activity. Typical range: 3-12.
  recencyBase: 40, // Higher makes very fresh activity dominate. Typical range: 20-60.
  recencyHalfLifeHours: 12, // Higher slows recency decay; lower makes the feed more now-focused. Typical range: 6-36 hours.
} as const;

// Schemas

const feedCursorPayloadSchema = z.object({
  seenReviewIds: z.array(z.uuid()).max(maxCursorSeenReviewIds).optional(),
});

// Types

type FeedCandidateSource = "followed" | "recent" | "recent-like";

interface FeedCursorPayload {
  seenReviewIds?: string[];
}

interface FeedCandidateRow {
  activityAt: Date;
  album: typeof albums.$inferSelect;
  canDelete: boolean;
  followedAuthor: boolean;
  liked: boolean;
  review: typeof reviews.$inferSelect;
  source: FeedCandidateSource;
  user: {
    avatarUrl: string | null;
    displayUsername: string | null;
    id: string;
    username: string | null;
  };
}

interface MergedFeedCandidate extends FeedCandidateRow {
  sourceRank: number;
}

interface FeedCandidate extends MergedFeedCandidate {
  likes: number;
  recentLikes: number;
}

interface FeedCursorParams {
  cursor?: FeedCursorPayload;
}

interface FeedCandidateBaseParams extends FeedCursorParams {
  recentLikeCutoff: Date;
}

interface GetAnonymousFeedCandidatesParams extends FeedCandidateBaseParams {
  reviewCreatedCutoff: Date;
}

interface GetAuthenticatedFeedCandidatesParams extends GetAnonymousFeedCandidatesParams {
  viewerUserId: string;
}

interface GetRecentReviewCandidatesParams extends FeedCursorParams {
  limit: number;
  reviewCreatedCutoff: Date;
  source: FeedCandidateSource;
  viewerUserId?: string;
}

interface GetFollowedReviewCandidatesParams extends FeedCursorParams {
  limit: number;
  reviewCreatedCutoff: Date;
  viewerUserId: string;
}

interface GetRecentLikeCandidatesParams extends FeedCandidateBaseParams {
  limit: number;
  viewerUserId?: string;
}

interface GetFeedCandidateSelectParams {
  viewerUserId?: string;
}

interface RankFeedCandidatesParams {
  now: Date;
  viewerUserId?: string;
}

export interface FeedInput {
  cursor?: string;
}

export interface FeedPage {
  nextCursor: string | null;
  reviews: ReturnType<typeof mapFeedReview>[];
}

// Services

export async function getFeedService(data: FeedInput): Promise<FeedPage> {
  const db = await getDb();
  const viewerUserId = await getOptionalCurrentUserId(db);
  const now = new Date();
  const recentLikeCutoff = subDays(now, recentLikeWindowDays);
  const reviewCreatedCutoff = subDays(now, feedLookbackDays);
  const cursor = data.cursor ? decodeFeedCursor(data.cursor) : undefined;

  const candidates = viewerUserId
    ? await getAuthenticatedFeedCandidates(db, {
        cursor,
        recentLikeCutoff,
        reviewCreatedCutoff,
        viewerUserId,
      })
    : await getAnonymousFeedCandidates(db, {
        cursor,
        recentLikeCutoff,
        reviewCreatedCutoff,
      });

  return mapFeedPage(rankAndFilterCandidates(candidates, { now, viewerUserId }), cursor?.seenReviewIds ?? []);
}

// Candidate queries

async function getAnonymousFeedCandidates(
  db: Db,
  { cursor, recentLikeCutoff, reviewCreatedCutoff }: GetAnonymousFeedCandidatesParams
) {
  const [recentRows, recentLikeRows] = await Promise.all([
    getRecentReviewCandidates(db, {
      cursor,
      limit: globalRecentCandidateLimit,
      reviewCreatedCutoff,
      source: "recent",
    }),
    getRecentLikeCandidates(db, {
      cursor,
      limit: globalLikedCandidateLimit,
      recentLikeCutoff,
    }),
  ]);

  return hydrateCandidateLikeStats(db, mergeCandidateRows([...recentRows, ...recentLikeRows]), recentLikeCutoff);
}

async function getAuthenticatedFeedCandidates(
  db: Db,
  { cursor, recentLikeCutoff, reviewCreatedCutoff, viewerUserId }: GetAuthenticatedFeedCandidatesParams
) {
  const [followedRows, recentRows, recentLikeRows] = await Promise.all([
    getFollowedReviewCandidates(db, {
      cursor,
      limit: followedCandidateLimit,
      reviewCreatedCutoff,
      viewerUserId,
    }),
    getRecentReviewCandidates(db, {
      cursor,
      limit: authenticatedGlobalCandidateLimit,
      reviewCreatedCutoff,
      source: "recent",
      viewerUserId,
    }),
    getRecentLikeCandidates(db, {
      cursor,
      limit: globalLikedCandidateLimit,
      recentLikeCutoff,
      viewerUserId,
    }),
  ]);

  return hydrateCandidateLikeStats(
    db,
    mergeCandidateRows([...followedRows, ...recentRows, ...recentLikeRows]),
    recentLikeCutoff
  );
}

function getRecentReviewCandidates(
  db: Db,
  { cursor, limit, reviewCreatedCutoff, source, viewerUserId }: GetRecentReviewCandidatesParams
) {
  const seenReviewsFilter = getSeenReviewsFilter(cursor);

  return db
    .select({
      ...getFeedCandidateSelect({ viewerUserId }),
      activityAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(
      and(
        isNotNull(user.username),
        getVisibleReviewAuthorFilter(),
        gt(reviews.createdAt, reviewCreatedCutoff),
        seenReviewsFilter
      )
    )
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(limit)
    .then((rows) => rows.map((row) => ({ ...row, source })));
}

function getFollowedReviewCandidates(
  db: Db,
  { cursor, limit, reviewCreatedCutoff, viewerUserId }: GetFollowedReviewCandidatesParams
) {
  const seenReviewsFilter = getSeenReviewsFilter(cursor);

  return db
    .select({
      ...getFeedCandidateSelect({ viewerUserId }),
      activityAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(userFollows, and(eq(userFollows.followerId, viewerUserId), eq(userFollows.followingId, reviews.userId)))
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(
      and(
        isNotNull(user.username),
        getVisibleReviewAuthorFilter(),
        gt(reviews.createdAt, reviewCreatedCutoff),
        seenReviewsFilter
      )
    )
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(limit)
    .then((rows) => rows.map((row) => ({ ...row, source: "followed" as const })));
}

function getRecentLikeCandidates(
  db: Db,
  { cursor, limit, recentLikeCutoff, viewerUserId }: GetRecentLikeCandidatesParams
) {
  const seenReviewsFilter = getSeenReviewsFilter(cursor);
  const likedUser = alias(user, "liked_user");

  return db
    .select({
      ...getFeedCandidateSelect({ viewerUserId }),
      activityAt: reviewLikes.createdAt,
    })
    .from(reviewLikes)
    .innerJoin(reviews, eq(reviewLikes.reviewId, reviews.id))
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .innerJoin(user, eq(reviews.userId, user.id))
    .innerJoin(likedUser, eq(reviewLikes.userId, likedUser.id))
    .where(
      and(
        isNotNull(user.username),
        getVisibleReviewAuthorFilter(),
        sql`${likedUser.banned} is not true`,
        gt(reviewLikes.createdAt, recentLikeCutoff),
        seenReviewsFilter
      )
    )
    .orderBy(desc(reviewLikes.createdAt), desc(reviewLikes.reviewId))
    .limit(limit)
    .then((rows) => rows.map((row) => ({ ...row, source: "recent-like" as const })));
}

function getFeedCandidateSelect({ viewerUserId }: GetFeedCandidateSelectParams) {
  const canDelete = viewerUserId ? sql<boolean>`${reviews.userId} = ${viewerUserId}` : sql<boolean>`false`;
  const liked = viewerUserId
    ? sql<boolean>`exists(select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerUserId})`
    : sql<boolean>`false`;
  const followedAuthor = viewerUserId
    ? sql<boolean>`exists(select 1 from ${userFollows} where ${userFollows.followerId} = ${viewerUserId} and ${userFollows.followingId} = ${reviews.userId})`
    : sql<boolean>`false`;

  return {
    album: getTableColumns(albums),
    canDelete,
    followedAuthor,
    liked,
    review: getTableColumns(reviews),
    user: {
      avatarUrl: user.image,
      displayUsername: user.displayUsername,
      id: user.id,
      username: user.username,
    },
  };
}

// Ranking

function rankAndFilterCandidates(candidates: FeedCandidate[], { now, viewerUserId }: RankFeedCandidatesParams) {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreFeedCandidate(candidate, { now, viewerUserId }),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.candidate.activityAt.getTime() !== a.candidate.activityAt.getTime()) {
        return b.candidate.activityAt.getTime() - a.candidate.activityAt.getTime();
      }
      return b.candidate.review.id.localeCompare(a.candidate.review.id);
    })
    .map(({ candidate }) => candidate);

  return applyDiversityFilters(ranked);
}

function scoreFeedCandidate(candidate: FeedCandidate, { now, viewerUserId }: RankFeedCandidatesParams) {
  const hasBody = Boolean(candidate.review.body?.trim());
  const ageHours = Math.max(0, now.getTime() - candidate.activityAt.getTime()) / 3_600_000;
  const recencyScore = feedScoreWeights.recencyBase / (1 + ageHours / feedScoreWeights.recencyHalfLifeHours);
  const followedAuthorBoost = viewerUserId && candidate.followedAuthor ? feedScoreWeights.followedAuthor : 0;
  const bodyBoost = hasBody ? feedScoreWeights.body : feedScoreWeights.ratingOnly;
  const likeBoost = Math.log1p(candidate.likes) * feedScoreWeights.like;
  const ownAuthorBoost = viewerUserId === candidate.review.userId ? feedScoreWeights.ownAuthor : 0;
  const recentLikeBoost = Math.log1p(candidate.recentLikes) * feedScoreWeights.recentLike;
  const sourceBoost = candidate.sourceRank;

  return recencyScore + followedAuthorBoost + bodyBoost + likeBoost + ownAuthorBoost + recentLikeBoost + sourceBoost;
}

function applyDiversityFilters(candidates: FeedCandidate[]) {
  const albumCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  const ratingOnlyLimit = Math.floor(feedPageSize * maxRatingOnlyRatio);
  const selected: FeedCandidate[] = [];
  let ratingOnlyCount = 0;

  for (const candidate of candidates) {
    const albumCount = albumCounts.get(candidate.review.albumId) ?? 0;
    const authorCount = authorCounts.get(candidate.review.userId) ?? 0;
    const isRatingOnly = !candidate.review.body?.trim();

    if (albumCount >= maxPerAlbum) continue;
    if (authorCount >= maxPerAuthor) continue;
    if (isRatingOnly && ratingOnlyCount >= ratingOnlyLimit) continue;

    selected.push(candidate);
    albumCounts.set(candidate.review.albumId, albumCount + 1);
    authorCounts.set(candidate.review.userId, authorCount + 1);
    if (isRatingOnly) ratingOnlyCount += 1;

    if (selected.length === feedPageSize) break;
  }

  return selected;
}

async function hydrateCandidateLikeStats(
  db: Db,
  candidates: MergedFeedCandidate[],
  recentLikeCutoff: Date
): Promise<FeedCandidate[]> {
  if (candidates.length === 0) return [];

  const reviewIds = candidates.map((candidate) => candidate.review.id);
  const recentLikeCutoffIso = recentLikeCutoff.toISOString();
  const likeStats = await db
    .select({
      likes: sql<number>`count(*)::int`,
      recentLikes: sql<number>`count(*) filter (where ${reviewLikes.createdAt} > ${recentLikeCutoffIso})::int`,
      reviewId: reviewLikes.reviewId,
    })
    .from(reviewLikes)
    .innerJoin(user, eq(reviewLikes.userId, user.id))
    .where(and(inArray(reviewLikes.reviewId, reviewIds), sql`${user.banned} is not true`))
    .groupBy(reviewLikes.reviewId);
  const likeStatsByReviewId = new Map(likeStats.map((stats) => [stats.reviewId, stats]));

  return candidates.map((candidate) => {
    const stats = likeStatsByReviewId.get(candidate.review.id);

    return {
      ...candidate,
      likes: stats?.likes ?? 0,
      recentLikes: stats?.recentLikes ?? 0,
    };
  });
}

function mergeCandidateRows(rows: FeedCandidateRow[]): MergedFeedCandidate[] {
  const candidatesById = new Map<string, MergedFeedCandidate>();

  for (const row of rows) {
    const existing = candidatesById.get(row.review.id);
    const sourceRank = getSourceRank(row.source);

    if (!existing) {
      candidatesById.set(row.review.id, { ...row, sourceRank });
      continue;
    }

    candidatesById.set(row.review.id, {
      ...existing,
      activityAt: row.activityAt > existing.activityAt ? row.activityAt : existing.activityAt,
      canDelete: existing.canDelete || row.canDelete,
      followedAuthor: existing.followedAuthor || row.followedAuthor,
      liked: existing.liked || row.liked,
      source: sourceRank > existing.sourceRank ? row.source : existing.source,
      sourceRank: Math.max(existing.sourceRank, sourceRank),
    });
  }

  return [...candidatesById.values()];
}

function getSourceRank(source: FeedCandidateSource) {
  if (source === "followed") return feedSourceRank.followed;
  if (source === "recent-like") return feedSourceRank.recentLike;

  return feedSourceRank.recent;
}

// Mappers

function mapFeedPage(candidates: FeedCandidate[], seenReviewIds: string[]): FeedPage {
  const nextSeenReviewIds = getNextSeenReviewIds(seenReviewIds, candidates);

  return {
    nextCursor: candidates.length ? encodeCursor({ seenReviewIds: nextSeenReviewIds }) : null,
    reviews: candidates.map(mapFeedReview),
  };
}

function mapFeedReview(candidate: FeedCandidate) {
  return {
    album: {
      artist: candidate.album.artistNames.join(", "),
      coverUrl: candidate.album.coverUrl ?? undefined,
      id: candidate.album.id,
      title: candidate.album.title,
      year: String(candidate.album.releaseYear),
    },
    canDelete: candidate.canDelete,
    createdAt: candidate.review.createdAt,
    id: candidate.review.id,
    liked: candidate.liked,
    likes: candidate.likes,
    rating: candidate.review.rating / 2,
    review: candidate.review.body ?? undefined,
    shareCode: candidate.review.shareCode,
    user: {
      avatarUrl: candidate.user.avatarUrl ?? undefined,
      displayUsername: candidate.user.displayUsername ?? candidate.user.username ?? candidate.user.id,
      username: candidate.user.username ?? undefined,
    },
  };
}

// Cursors

function getSeenReviewsFilter(cursor?: FeedCursorPayload): SQL | undefined {
  return cursor?.seenReviewIds?.length ? notInArray(reviews.id, cursor.seenReviewIds) : undefined;
}

function getVisibleReviewAuthorFilter(): SQL {
  return sql`${user.banned} is not true`;
}

function decodeFeedCursor(cursor: string): FeedCursorPayload {
  return decodeCursor(cursor, feedCursorPayloadSchema, "Invalid feed cursor");
}

function getNextSeenReviewIds(seenReviewIds: string[], candidates: FeedCandidate[]) {
  const nextSeenReviewIds = new Set(seenReviewIds);

  for (const candidate of candidates) {
    nextSeenReviewIds.add(candidate.review.id);
  }

  return [...nextSeenReviewIds].slice(-maxCursorSeenReviewIds);
}

// Dates

function subDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}
