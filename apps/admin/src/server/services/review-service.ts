import { albums, reviewLikes, reviews, user } from "@ratio/database/schema";
import { and, asc, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { toFiniteNumber } from "@/lib/format";
import {
  buildQueryParams,
  buildSortingClause,
  type TableQueryConfig,
  type TableQueryInput,
  type TableQueryResult,
} from "../table-query";
import type { getDb } from "@/lib/db";

// Constants

const sortColumns = {
  album: albums.title,
  createdAt: reviews.createdAt,
} as const;

const filterColumns = {
  album: albums.title,
  body: reviews.body,
  createdAt: reviews.createdAt,
} as const;

const reviewTableConfig: TableQueryConfig<typeof sortColumns, typeof filterColumns> = {
  sortColumns,
  filterColumns,
  dateColumns: new Set(["createdAt"]),
  textColumns: new Set(["album", "body"]),
};

const WHITESPACE_REGEX = /\s+/;
const reviewAlbumArtists = sql<string>`array_to_string(${albums.artistNames}, ' ')`;
const reviewUserIdentity = sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`;

// Types

export interface AdminReviewContext {
  db: Awaited<ReturnType<typeof getDb>>;
}

export interface GetTableReviewsInput extends TableQueryInput {}

export interface AdminReviewTablePage extends TableQueryResult<AdminReviewRow> {}

export interface AdminReviewStats {
  newLast7Days: number;
  newLast30Days: number;
  newPrev7Days: number;
  newPrev30Days: number;
  totalReviews: number;
  writtenReviews: number;
}

export interface AdminReviewRow {
  albumArtistNames: string[];
  albumCoverUrl: string | null;
  albumId: string;
  albumTitle: string;
  body: string | null;
  createdAt: Date;
  id: string;
  likeCount: number;
  rating: number;
  shareCode: string;
  userDisplayUsername: string | null;
  userId: string;
  userImage: string | null;
  userName: string;
  username: string | null;
}

// Services

export async function getTableReviewsService(data: GetTableReviewsInput, context: AdminReviewContext) {
  const { album: albumFilter, user: userFilter, ...filters } = data.filters;
  const nonUserSorting = data.sorting.filter((sort) => sort.id !== "user");
  const queryParams = buildQueryParams({ ...data, filters, sorting: nonUserSorting }, reviewTableConfig);
  const albumFilterCondition = buildAlbumFilterCondition(albumFilter);
  const userFilterCondition = buildUserFilterCondition(userFilter);
  const whereClause = and(queryParams.whereClause, albumFilterCondition, userFilterCondition);
  const orderBy = data.sorting.flatMap((sort) => {
    if (sort.id === "user") {
      return [sort.desc ? desc(reviewUserIdentity) : asc(reviewUserIdentity)];
    }

    return buildSortingClause([sort], sortColumns);
  });
  const baseQuery = context.db
    .select({
      albumArtistNames: albums.artistNames,
      albumCoverUrl: albums.coverUrl,
      albumId: albums.id,
      albumTitle: albums.title,
      body: reviews.body,
      createdAt: reviews.createdAt,
      id: reviews.id,
      likeCount: count(reviewLikes.userId),
      rating: reviews.rating,
      shareCode: reviews.shareCode,
      userDisplayUsername: user.displayUsername,
      userId: user.id,
      userImage: user.image,
      userName: user.name,
      username: user.username,
    })
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id));
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const groupedQuery = filteredQuery.groupBy(reviews.id, user.id, albums.id);
  const sortedQuery = orderBy.length > 0 ? groupedQuery.orderBy(...orderBy) : groupedQuery;

  const totalQuery = context.db
    .select({ count: count() })
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .innerJoin(albums, eq(reviews.albumId, albums.id));
  const filteredTotalQuery = whereClause ? totalQuery.where(whereClause) : totalQuery;

  const [rows, totalCount] = await Promise.all([
    sortedQuery.limit(queryParams.limit).offset(queryParams.offset),
    filteredTotalQuery,
  ]);

  return {
    data: rows,
    pageCount: Math.ceil(totalCount[0].count / queryParams.limit),
  };
}

export async function getReviewStatsService(context: AdminReviewContext): Promise<AdminReviewStats> {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const last7Start = new Date(now - 7 * dayMs);
  const prev7Start = new Date(now - 14 * dayMs);
  const last30Start = new Date(now - 30 * dayMs);
  const prev30Start = new Date(now - 60 * dayMs);

  const [stats] = await context.db
    .select({
      newLast7Days: count(sql`case when ${gte(reviews.createdAt, last7Start)} then 1 end`),
      newLast30Days: count(sql`case when ${gte(reviews.createdAt, last30Start)} then 1 end`),
      newPrev7Days: count(
        sql`case when ${and(gte(reviews.createdAt, prev7Start), lt(reviews.createdAt, last7Start))} then 1 end`
      ),
      newPrev30Days: count(
        sql`case when ${and(gte(reviews.createdAt, prev30Start), lt(reviews.createdAt, last30Start))} then 1 end`
      ),
      totalReviews: count(),
      writtenReviews: count(
        sql`case when ${reviews.body} is not null and length(trim(${reviews.body})) > 0 then 1 end`
      ),
    })
    .from(reviews);

  return {
    newLast7Days: toFiniteNumber(stats.newLast7Days),
    newLast30Days: toFiniteNumber(stats.newLast30Days),
    newPrev7Days: toFiniteNumber(stats.newPrev7Days),
    newPrev30Days: toFiniteNumber(stats.newPrev30Days),
    totalReviews: toFiniteNumber(stats.totalReviews),
    writtenReviews: toFiniteNumber(stats.writtenReviews),
  };
}

function buildAlbumFilterCondition(value: TableQueryInput["filters"][string]) {
  return buildMultiFieldTextCondition(value, (term) =>
    or(ilike(albums.title, `%${term}%`), ilike(reviewAlbumArtists, `%${term}%`))
  );
}

function buildUserFilterCondition(value: TableQueryInput["filters"][string]) {
  return buildMultiFieldTextCondition(value, (term) =>
    or(ilike(user.displayUsername, `%${term}%`), ilike(user.username, `%${term}%`), ilike(user.name, `%${term}%`))
  );
}

function buildMultiFieldTextCondition(
  value: TableQueryInput["filters"][string],
  buildTermCondition: (term: string) => ReturnType<typeof or>
) {
  const values = Array.isArray(value) ? value : [value];
  const searchTerms = values
    .flatMap((item) =>
      String(item ?? "")
        .trim()
        .split(WHITESPACE_REGEX)
    )
    .filter(Boolean);

  if (searchTerms.length === 0) return;

  return and(...searchTerms.map(buildTermCondition));
}

export async function deleteReviewService(reviewId: string, context: AdminReviewContext) {
  const [deletedReview] = await context.db
    .delete(reviews)
    .where(eq(reviews.id, reviewId))
    .returning({ id: reviews.id });

  if (!deletedReview) {
    throw new Error("Review not found");
  }

  return deletedReview;
}
