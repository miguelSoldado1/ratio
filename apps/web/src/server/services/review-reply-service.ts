import { and, asc, count, desc, eq, getTableColumns, gt, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";
import { getDb } from "@/lib/db";
import { reviewReplies, reviewReplyLikes, reviews, user } from "@/lib/db/schema";
import { type FollowableUserRow, getFollowedByViewerSql, mapFollowableUser } from "../followable-user";
import { decodeCursor, encodeCursor, getCreatedAtIdCursorFilter, getOptionalCurrentUser } from "../server-utils";
import { createReplyLikedNotification, createReviewRepliedNotifications } from "./notification-service";
import type { AnyColumn } from "drizzle-orm/column";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "../auth-middleware";

// Constants

const reviewRepliesPageSize = 12;
const reviewReplyLikesPageSize = 24;

// Schemas

const reviewRepliesCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

const reviewReplyLikesCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().trim().min(1).max(128),
});

// Types

interface ReviewRepliesCursorPayload {
  createdAt: string;
  id: string;
}

interface ReviewReplyLikesCursorPayload {
  createdAt: string;
  id: string;
}

export interface GetReviewRepliesInput {
  cursor?: string;
  reviewId: string;
}

export interface GetReviewReplyLikesInput {
  cursor?: string;
  replyId: string;
}

export interface ReviewReplyLikesPage {
  nextCursor: string | null;
  users: ReturnType<typeof mapFollowableUser>[];
}

export interface CreateReviewReplyInput {
  body: string;
  reviewId: string;
}

export interface DeleteReviewReplyInput {
  replyId: string;
}

export interface SetReviewReplyLikeInput extends DeleteReviewReplyInput {
  liked: boolean;
}

// Services

export async function getReviewRepliesService(data: GetReviewRepliesInput) {
  const db = await getDb();
  const currentUser = await getOptionalCurrentUser(db);
  const viewerUserId = currentUser?.id;
  const cursor = data.cursor ? decodeReviewRepliesCursor(data.cursor) : undefined;
  const replyAuthor = alias(user, "review_reply_author");
  const reviewAuthor = alias(user, "review_reply_review_author");
  const likedByViewer = viewerUserId
    ? sql<boolean>`exists(
        select 1
        from ${reviewReplyLikes}
        where ${reviewReplyLikes.replyId} = ${reviewReplies.id}
          and ${reviewReplyLikes.userId} = ${viewerUserId}
      )`
    : sql<boolean>`false`;

  const canDelete = viewerUserId ? sql<boolean>`${reviewReplies.userId} = ${viewerUserId}` : sql<boolean>`false`;
  const cursorFilter = cursor ? getReviewRepliesCursorFilter(cursor) : undefined;
  const visibilityFilter = getThreadVisibilityFilter(replyAuthor, reviewAuthor, currentUser?.isAdmin ?? false);

  const rows = await db
    .select({
      canDelete,
      liked: likedByViewer,
      likes: getVisibleReplyLikeCountSql(reviewReplies.id),
      reply: getTableColumns(reviewReplies),
      totalCount: cursor ? sql<number>`0` : sql<number>`count(*) over()::int`,
      user: {
        avatarUrl: replyAuthor.image,
        displayUsername: replyAuthor.displayUsername,
        id: replyAuthor.id,
        username: replyAuthor.username,
      },
    })
    .from(reviewReplies)
    .innerJoin(reviews, eq(reviewReplies.reviewId, reviews.id))
    .innerJoin(replyAuthor, eq(reviewReplies.userId, replyAuthor.id))
    .innerJoin(reviewAuthor, eq(reviews.userId, reviewAuthor.id))
    .where(and(eq(reviewReplies.reviewId, data.reviewId), visibilityFilter, cursorFilter))
    .orderBy(asc(reviewReplies.createdAt), asc(reviewReplies.id))
    .limit(reviewRepliesPageSize + 1);

  const hasNextPage = rows.length > reviewRepliesPageSize;
  const pageRows = hasNextPage ? rows.slice(0, reviewRepliesPageSize) : rows;
  const mappedReplies = pageRows.flatMap(mapReviewReplyRow);
  const lastReply = mappedReplies.at(-1);

  return {
    nextCursor:
      hasNextPage && lastReply
        ? encodeCursor({
            createdAt: lastReply.createdAt.toISOString(),
            id: lastReply.id,
          })
        : null,
    replies: mappedReplies,
    totalCount: cursor ? null : (rows[0]?.totalCount ?? 0),
  };
}

export async function getReviewReplyLikesService(data: GetReviewReplyLikesInput) {
  const db = await getDb();
  const currentUser = await getOptionalCurrentUser(db);
  const viewerUserId = currentUser?.id;
  const replyAuthor = alias(user, "review_reply_likes_reply_author");
  const reviewAuthor = alias(user, "review_reply_likes_review_author");
  const [targetReply] = await db
    .select({ id: reviewReplies.id })
    .from(reviewReplies)
    .innerJoin(reviews, eq(reviewReplies.reviewId, reviews.id))
    .innerJoin(replyAuthor, eq(reviewReplies.userId, replyAuthor.id))
    .innerJoin(reviewAuthor, eq(reviews.userId, reviewAuthor.id))
    .where(
      and(
        eq(reviewReplies.id, data.replyId),
        getThreadVisibilityFilter(replyAuthor, reviewAuthor, currentUser?.isAdmin ?? false)
      )
    )
    .limit(1);

  if (!targetReply) {
    throw new Error("Reply not found");
  }

  const cursor = data.cursor ? decodeReviewReplyLikesCursor(data.cursor) : undefined;
  const cursorFilter = cursor ? getReviewReplyLikesCursorFilter(cursor) : undefined;
  const likedUser = alias(user, "review_reply_liked_user");
  const likedUserId = sql.raw('"review_reply_liked_user"."id"');

  const followedByViewer = getFollowedByViewerSql(viewerUserId, likedUserId);
  const likeSelect = {
    followedByViewer,
    likeCreatedAt: reviewReplyLikes.createdAt,
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
          .select(likeSelect)
          .from(reviewReplyLikes)
          .innerJoin(likedUser, eq(reviewReplyLikes.userId, likedUser.id))
          .where(
            and(
              eq(reviewReplyLikes.replyId, data.replyId),
              eq(reviewReplyLikes.userId, viewerUserId),
              isNotNull(likedUser.username),
              sql`${likedUser.banned} is not true`
            )
          )
          .limit(1)
      : [];

  const likeRows = await db
    .select(likeSelect)
    .from(reviewReplyLikes)
    .innerJoin(likedUser, eq(reviewReplyLikes.userId, likedUser.id))
    .where(
      and(
        eq(reviewReplyLikes.replyId, data.replyId),
        isNotNull(likedUser.username),
        sql`${likedUser.banned} is not true`,
        viewerUserId ? ne(reviewReplyLikes.userId, viewerUserId) : undefined,
        cursorFilter
      )
    )
    .orderBy(desc(reviewReplyLikes.createdAt), desc(reviewReplyLikes.userId))
    .limit(reviewReplyLikesPageSize + 1);

  return mapReviewReplyLikesPage(likeRows, pinnedLikeRows);
}

export async function createReviewReplyService(data: CreateReviewReplyInput, context: AuthenticatedContext) {
  return await context.db.transaction(async (transaction) => {
    const actor = alias(user, "create_review_reply_actor");
    const reviewAuthor = alias(user, "create_review_reply_review_author");
    const rootVisibilityFilter = context.user.isAdmin
      ? isNotNull(reviewAuthor.username)
      : and(isNotNull(reviewAuthor.username), sql`${reviewAuthor.banned} is not true`);
    const [parent] = await transaction
      .select({
        actor: {
          avatarUrl: actor.image,
          displayUsername: actor.displayUsername,
          id: actor.id,
          username: actor.username,
        },
        reviewId: reviews.id,
      })
      .from(reviews)
      .innerJoin(reviewAuthor, eq(reviews.userId, reviewAuthor.id))
      .innerJoin(actor, eq(actor.id, context.user.id))
      .where(
        and(
          eq(reviews.id, data.reviewId),
          rootVisibilityFilter,
          isNotNull(actor.username),
          sql`${actor.banned} is not true`
        )
      )
      .limit(1)
      .for("update", { of: reviews });

    if (!parent?.actor.username) {
      throw new Error("Review not found");
    }

    const [reply] = await transaction
      .insert(reviewReplies)
      .values({
        body: data.body,
        createdAt: new Date(),
        reviewId: parent.reviewId,
        userId: context.user.id,
      })
      .returning();

    if (!reply) {
      throw new Error("Could not create reply");
    }

    await createReviewRepliedNotifications(
      {
        actorUserId: context.user.id,
        replyId: reply.id,
        reviewId: parent.reviewId,
      },
      transaction
    );

    return {
      body: reply.body,
      canDelete: true,
      createdAt: reply.createdAt,
      id: reply.id,
      liked: false,
      likes: 0,
      reviewId: reply.reviewId,
      user: {
        ...parent.actor,
        username: parent.actor.username,
      },
    };
  });
}

export async function deleteReviewReplyService(data: DeleteReviewReplyInput, context: AuthenticatedContext) {
  const ownershipFilter = context.user.isAdmin ? undefined : eq(reviewReplies.userId, context.user.id);
  const [deletedReply] = await context.db
    .delete(reviewReplies)
    .where(and(eq(reviewReplies.id, data.replyId), ownershipFilter))
    .returning({ id: reviewReplies.id, reviewId: reviewReplies.reviewId });

  if (!deletedReply) {
    throw new Error("Reply not found");
  }

  return {
    ...deletedReply,
    replyCount: await getReviewReplyCount(context.db, deletedReply.reviewId),
  };
}

export async function setReviewReplyLikeService(data: SetReviewReplyLikeInput, context: AuthenticatedContext) {
  await assertReplyIsLikeable(data.replyId, context);

  if (data.liked) {
    await context.db.transaction(async (transaction) => {
      const [insertedLike] = await transaction
        .insert(reviewReplyLikes)
        .values({ replyId: data.replyId, userId: context.user.id })
        .onConflictDoNothing()
        .returning({ replyId: reviewReplyLikes.replyId });

      if (insertedLike) {
        await createReplyLikedNotification({ actorUserId: context.user.id, replyId: data.replyId }, transaction);
      }
    });
  } else {
    await context.db
      .delete(reviewReplyLikes)
      .where(and(eq(reviewReplyLikes.replyId, data.replyId), eq(reviewReplyLikes.userId, context.user.id)));
  }

  const [likeCount] = await context.db
    .select({ likes: count(reviewReplyLikes.replyId) })
    .from(reviewReplyLikes)
    .innerJoin(user, eq(reviewReplyLikes.userId, user.id))
    .where(and(eq(reviewReplyLikes.replyId, data.replyId), sql`${user.banned} is not true`));

  return {
    liked: data.liked,
    likes: likeCount?.likes ?? 0,
    replyId: data.replyId,
  };
}

// Helpers

async function assertReplyIsLikeable(replyId: string, context: AuthenticatedContext) {
  const replyAuthor = alias(user, "likeable_reply_author");
  const reviewAuthor = alias(user, "likeable_reply_review_author");
  const [targetReply] = await context.db
    .select({ id: reviewReplies.id })
    .from(reviewReplies)
    .innerJoin(reviews, eq(reviewReplies.reviewId, reviews.id))
    .innerJoin(replyAuthor, eq(reviewReplies.userId, replyAuthor.id))
    .innerJoin(reviewAuthor, eq(reviews.userId, reviewAuthor.id))
    .where(
      and(eq(reviewReplies.id, replyId), getThreadVisibilityFilter(replyAuthor, reviewAuthor, context.user.isAdmin))
    )
    .limit(1);

  if (!targetReply) {
    throw new Error("Reply not found");
  }
}

export async function getReviewReplyCounts(db: Db, reviewIds: string[]) {
  const counts = new Map<string, number>();

  if (reviewIds.length === 0) return counts;

  const replyAuthor = alias(user, "review_reply_count_author");
  const rows = await db
    .select({ count: count(reviewReplies.id), reviewId: reviewReplies.reviewId })
    .from(reviewReplies)
    .innerJoin(replyAuthor, eq(reviewReplies.userId, replyAuthor.id))
    .where(
      and(
        inArray(reviewReplies.reviewId, reviewIds),
        isNotNull(replyAuthor.username),
        sql`${replyAuthor.banned} is not true`
      )
    )
    .groupBy(reviewReplies.reviewId);

  for (const row of rows) counts.set(row.reviewId, row.count);

  return counts;
}

async function getReviewReplyCount(db: Db, reviewId: string) {
  const counts = await getReviewReplyCounts(db, [reviewId]);

  return counts.get(reviewId) ?? 0;
}

export function getVisibleReplyLikeCountSql(replyId: typeof reviewReplies.id) {
  return sql<number>`(
    select count(*)::int
    from ${reviewReplyLikes}
    where ${reviewReplyLikes.replyId} = ${replyId}
      and exists(
        select 1
        from ${user}
        where ${user.id} = ${reviewReplyLikes.userId}
          and ${user.banned} is not true
      )
  )`;
}

export function getVisibleReviewReplyCountSql(reviewId: typeof reviews.id) {
  return sql<number>`(
    select count(*)::int
    from ${reviewReplies}
    inner join ${user} on ${user.id} = ${reviewReplies.userId}
    where ${reviewReplies.reviewId} = ${reviewId}
      and ${user.username} is not null
      and ${user.banned} is not true
  )`;
}

function getThreadVisibilityFilter(
  replyAuthor: { banned: AnyColumn; username: AnyColumn },
  reviewAuthor: { banned: AnyColumn; username: AnyColumn },
  isAdmin: boolean
) {
  return and(
    isNotNull(replyAuthor.username),
    isNotNull(reviewAuthor.username),
    isAdmin ? undefined : sql`${replyAuthor.banned} is not true`,
    isAdmin ? undefined : sql`${reviewAuthor.banned} is not true`
  );
}

// Rows

interface ReviewReplyRow {
  canDelete: boolean;
  liked: boolean;
  likes: number;
  reply: typeof reviewReplies.$inferSelect;
  user: {
    avatarUrl: string | null;
    displayUsername: string | null;
    id: string;
    username: string | null;
  };
}

interface ReviewReplyLikeUserRow extends FollowableUserRow {
  likeCreatedAt: Date;
}

// Mappers

function mapReviewReplyRow(row: ReviewReplyRow) {
  if (!row.user.username) return [];

  return [
    {
      body: row.reply.body,
      canDelete: row.canDelete,
      createdAt: row.reply.createdAt,
      id: row.reply.id,
      liked: row.liked,
      likes: row.likes,
      reviewId: row.reply.reviewId,
      user: {
        ...row.user,
        username: row.user.username,
      },
    },
  ];
}

function mapReviewReplyLikesPage(rows: ReviewReplyLikeUserRow[], pinnedRows: ReviewReplyLikeUserRow[] = []) {
  const hasNextPage = rows.length > reviewReplyLikesPageSize;
  const pageRows = hasNextPage ? rows.slice(0, reviewReplyLikesPageSize) : rows;
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

// Cursors

function getReviewRepliesCursorFilter(cursor: ReviewRepliesCursorPayload) {
  const cursorCreatedAt = new Date(cursor.createdAt);

  return or(
    gt(reviewReplies.createdAt, cursorCreatedAt),
    and(eq(reviewReplies.createdAt, cursorCreatedAt), gt(reviewReplies.id, cursor.id))
  );
}

function decodeReviewRepliesCursor(cursor: string) {
  return decodeCursor(cursor, reviewRepliesCursorPayloadSchema, "Invalid review replies cursor");
}

/** Applies newest-first keyset pagination to reply likes. */
function getReviewReplyLikesCursorFilter(cursor: ReviewReplyLikesCursorPayload) {
  return getCreatedAtIdCursorFilter(cursor, {
    createdAt: reviewReplyLikes.createdAt,
    id: reviewReplyLikes.userId,
  });
}

/** Validates and decodes an opaque reply-likes cursor. */
function decodeReviewReplyLikesCursor(cursor: string) {
  return decodeCursor(cursor, reviewReplyLikesCursorPayloadSchema, "Invalid review reply likes cursor");
}
