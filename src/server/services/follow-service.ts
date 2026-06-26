import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { user, userFollows } from "@/lib/db/schema";
import type { AuthenticatedContext } from "../auth-middleware";

export interface SetUserFollowInput {
  following: boolean;
  userId: string;
}

export async function setUserFollowService(data: SetUserFollowInput, context: AuthenticatedContext) {
  if (data.userId === context.user.id) {
    throw new Error("You cannot follow yourself");
  }

  const targetUser = await getUserExists(context, data.userId);
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

async function getUserExists(context: AuthenticatedContext, userId: string) {
  const [targetUser] = await context.db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);

  return targetUser;
}

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
