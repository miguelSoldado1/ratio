import { sql } from "drizzle-orm";
import { userFollows } from "@/lib/db/schema";

export interface FollowableUserRow {
  followedByViewer: boolean;
  user: {
    avatarUrl: string | null;
    displayUsername: string | null;
    id: string;
    name: string;
    username: string | null;
  };
}

export function getFollowedByViewerSql(viewerUserId: string | undefined, listedUserId: ReturnType<typeof sql.raw>) {
  return viewerUserId
    ? sql<boolean>`exists(select 1 from ${userFollows} where ${userFollows.followerId} = ${viewerUserId} and ${userFollows.followingId} = ${listedUserId})`
    : sql<boolean>`false`;
}

export function mapFollowableUser(row: FollowableUserRow) {
  return {
    avatarUrl: row.user.avatarUrl ?? undefined,
    displayName: row.user.displayUsername ?? row.user.name,
    followedByViewer: row.followedByViewer,
    id: row.user.id,
    username: row.user.username ?? row.user.id,
  };
}
