import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";
import { getDb } from "@/lib/db";
import { user, userFollows } from "@/lib/db/schema";
import { type FollowableUserRow, getFollowedByViewerSql, mapFollowableUser } from "../followable-user";
import { decodeCursor, encodeCursor, getCreatedAtIdCursorFilter, getOptionalCurrentUserId } from "../server-utils";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "../auth-middleware";

// Constants

const userFollowsPageSize = 24;

// Schemas

const userFollowsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().trim().min(1).max(128),
});

// Types

interface UserFollowsCursorPayload {
  createdAt: string;
  id: string;
}

interface UserFollowsRow extends FollowableUserRow {
  followCreatedAt: Date;
}

export interface UserFollowsInput {
  cursor?: string;
  userId: string;
}

export interface UserFollowsPage {
  nextCursor: string | null;
  users: ReturnType<typeof mapFollowableUser>[];
}

export interface SetUserFollowInput {
  following: boolean;
  userId: string;
}

// Services

export async function getUserFollowersService(data: UserFollowsInput): Promise<UserFollowsPage> {
  const db = await getDb();
  const viewerUserId = await getOptionalCurrentUserId(db);
  const targetUser = await getUserExists(db, data.userId);
  if (!targetUser) {
    throw new Error("User not found");
  }

  const cursor = data.cursor ? decodeUserFollowsCursor(data.cursor) : undefined;
  const cursorFilter = cursor ? getUserFollowsCursorFilter(cursor, userFollows.followerId) : undefined;
  const followerUser = alias(user, "follower_user");
  const followerUserId = sql.raw('"follower_user"."id"');
  const followedByViewer = getFollowedByViewerSql(viewerUserId, followerUserId);

  const followerRows = await db
    .select({
      followedByViewer,
      followCreatedAt: userFollows.createdAt,
      user: {
        avatarUrl: followerUser.image,
        displayUsername: followerUser.displayUsername,
        id: followerUser.id,
        name: followerUser.name,
        username: followerUser.username,
      },
    })
    .from(userFollows)
    .innerJoin(followerUser, eq(userFollows.followerId, followerUser.id))
    .where(and(eq(userFollows.followingId, data.userId), isNotNull(followerUser.username), cursorFilter ?? undefined))
    .orderBy(desc(userFollows.createdAt), desc(userFollows.followerId))
    .limit(userFollowsPageSize + 1);

  return mapUserFollowsPage(followerRows, (row) => row.user.id);
}

export async function getUserFollowingService(data: UserFollowsInput): Promise<UserFollowsPage> {
  const db = await getDb();
  const viewerUserId = await getOptionalCurrentUserId(db);
  const targetUser = await getUserExists(db, data.userId);
  if (!targetUser) {
    throw new Error("User not found");
  }

  const cursor = data.cursor ? decodeUserFollowsCursor(data.cursor) : undefined;
  const cursorFilter = cursor ? getUserFollowsCursorFilter(cursor, userFollows.followingId) : undefined;
  const followingUser = alias(user, "following_user");
  const followingUserId = sql.raw('"following_user"."id"');
  const followedByViewer = getFollowedByViewerSql(viewerUserId, followingUserId);

  const followingRows = await db
    .select({
      followedByViewer,
      followCreatedAt: userFollows.createdAt,
      user: {
        avatarUrl: followingUser.image,
        displayUsername: followingUser.displayUsername,
        id: followingUser.id,
        name: followingUser.name,
        username: followingUser.username,
      },
    })
    .from(userFollows)
    .innerJoin(followingUser, eq(userFollows.followingId, followingUser.id))
    .where(and(eq(userFollows.followerId, data.userId), isNotNull(followingUser.username), cursorFilter ?? undefined))
    .orderBy(desc(userFollows.createdAt), desc(userFollows.followingId))
    .limit(userFollowsPageSize + 1);

  return mapUserFollowsPage(followingRows, (row) => row.user.id);
}

export async function setUserFollowService(data: SetUserFollowInput, context: AuthenticatedContext) {
  if (data.userId === context.user.id) {
    throw new Error("You cannot follow yourself");
  }

  const targetUser = await getUserExists(context.db, data.userId);
  if (!targetUser) {
    throw new Error("User not found");
  }

  if (data.following) {
    await context.db
      .insert(userFollows)
      .values({ followerId: context.user.id, followingId: data.userId })
      .onConflictDoNothing();
  } else {
    await context.db
      .delete(userFollows)
      .where(and(eq(userFollows.followerId, context.user.id), eq(userFollows.followingId, data.userId)));
  }

  const updatedCounts = await getUserFollowCounts(context, data.userId);

  return {
    followedByViewer: data.following,
    followersCount: updatedCounts.followersCount,
    followingCount: updatedCounts.followingCount,
    userId: data.userId,
  };
}

async function getUserExists(db: Db, userId: string) {
  const [targetUser] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);

  return targetUser;
}

// Mappers

function mapUserFollowsPage(rows: UserFollowsRow[], getCursorId: (row: UserFollowsRow) => string): UserFollowsPage {
  const hasNextPage = rows.length > userFollowsPageSize;
  const pageRows = hasNextPage ? rows.slice(0, userFollowsPageSize) : rows;
  const lastRow = pageRows.at(-1);

  return {
    nextCursor:
      hasNextPage && lastRow
        ? encodeCursor({
            createdAt: lastRow.followCreatedAt.toISOString(),
            id: getCursorId(lastRow),
          })
        : null,
    users: pageRows.map(mapFollowableUser),
  };
}

// Cursors

function getUserFollowsCursorFilter(
  cursor: UserFollowsCursorPayload,
  cursorIdColumn: typeof userFollows.followerId | typeof userFollows.followingId
) {
  return getCreatedAtIdCursorFilter(cursor, { createdAt: userFollows.createdAt, id: cursorIdColumn });
}

function decodeUserFollowsCursor(cursor: string): UserFollowsCursorPayload {
  return decodeCursor(cursor, userFollowsCursorPayloadSchema, "Invalid follows cursor");
}

// Counts

async function getUserFollowCounts(context: AuthenticatedContext, userId: string) {
  const followTargetUser = alias(user, "follow_target_user");
  const followTargetUserId = sql.raw('"follow_target_user"."id"');
  const [counts] = await context.db
    .select({
      followersCount: sql<number>`(select count(*)::int from ${userFollows} where ${userFollows.followingId} = ${followTargetUserId})`,
      followingCount: sql<number>`(select count(*)::int from ${userFollows} where ${userFollows.followerId} = ${followTargetUserId})`,
    })
    .from(followTargetUser)
    .where(eq(followTargetUser.id, userId))
    .limit(1);

  return counts;
}
