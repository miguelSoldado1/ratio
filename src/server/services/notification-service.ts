import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";
import { albums, notifications, type notificationType, reviewLikes, reviews, user } from "@/lib/db/schema";
import { decodeCursor, encodeCursor } from "../server-utils";
import type { AnyColumn } from "drizzle-orm/column";
import type { SelectedFieldsFlat } from "drizzle-orm/pg-core/query-builders/select.types";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "../auth-middleware";

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type NotificationWriteDb = Db | DbTransaction;
type NotificationType = (typeof notificationType.enumValues)[number];

// Constants

const notificationPageSize = 18;
const notificationHistoryDays = 90;

// Schemas

const notificationsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

// Types

interface NotificationsCursorPayload {
  createdAt: string;
  id: string;
}

interface NotificationActor {
  avatarUrl: string | null;
  displayUsername: string | null;
  id: string;
  username: string;
}

interface NotificationQueryActor {
  avatarUrl: string | null;
  displayUsername: string | null;
  id: string;
  username: string | null;
}

type NotificationQueryActorColumn = SelectedFieldsFlat[string];

interface NotificationQueryActorColumns {
  displayUsername: NotificationQueryActorColumn;
  id: NotificationQueryActorColumn;
  image: NotificationQueryActorColumn;
  username: NotificationQueryActorColumn;
}

interface UserFollowedNotificationQueryRow {
  actor: NotificationQueryActor;
  createdAt: Date;
  id: string;
  seenAt: Date | null;
  type: string;
}

interface NotificationGroupPageRow {
  groupId: string;
  latestCreatedAt: Date | string;
  latestNotificationId: string;
  type: NotificationType;
}

interface ReviewLikedNotificationGroup {
  actorCount: number;
  actors: NotificationActor[];
  albumId: string;
  albumTitle: string;
  reviewId: string;
  seen: boolean;
  type: "review_liked";
}

interface UserFollowedNotificationGroup {
  row: UserFollowedNotificationRow;
  type: "user_followed";
}

type HydratedNotificationGroup = ReviewLikedNotificationGroup | UserFollowedNotificationGroup;

interface UserFollowedNotificationRow {
  actor: NotificationActor;
  createdAt: Date;
  id: string;
  seenAt: Date | null;
  type: "user_followed";
}

export interface CreateReviewLikedNotificationInput {
  actorUserId: string;
  reviewId: string;
}

export interface CreateUserFollowedNotificationInput {
  actorUserId: string;
  recipientUserId: string;
}

export interface GetNotificationsInput {
  cursor?: string;
}

export interface ReviewLikedNotificationItem {
  actorCount: number;
  actors: NotificationActor[];
  albumId: string;
  albumTitle: string;
  href: string;
  key: string;
  latestCreatedAt: Date;
  reviewId: string;
  seen: boolean;
  text: string;
  type: "review_liked";
}

export interface UserFollowedNotificationItem {
  actor: NotificationActor;
  href: string;
  key: string;
  latestCreatedAt: Date;
  seen: boolean;
  text: string;
  type: "user_followed";
}

export type NotificationItem = ReviewLikedNotificationItem | UserFollowedNotificationItem;

export interface NotificationsPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

// Services

export async function createReviewLikedNotification(
  { actorUserId, reviewId }: CreateReviewLikedNotificationInput,
  db: NotificationWriteDb
) {
  const [review] = await db
    .select({ recipientUserId: reviews.userId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review || review.recipientUserId === actorUserId) return null;

  const now = new Date();
  const [notification] = await db
    .insert(notifications)
    .values({
      actorUserId,
      createdAt: now,
      recipientUserId: review.recipientUserId,
      reviewId,
      seenAt: null,
      type: "review_liked",
    })
    .onConflictDoUpdate({
      target: [notifications.recipientUserId, notifications.actorUserId, notifications.type, notifications.reviewId],
      targetWhere: sql`${notifications.type} = 'review_liked'`,
      set: {
        createdAt: now,
        seenAt: null,
      },
    })
    .returning();

  return notification;
}

export async function createUserFollowedNotification(
  { actorUserId, recipientUserId }: CreateUserFollowedNotificationInput,
  db: NotificationWriteDb
) {
  if (actorUserId === recipientUserId) return null;

  const now = new Date();
  const [notification] = await db
    .insert(notifications)
    .values({
      actorUserId,
      createdAt: now,
      recipientUserId,
      seenAt: null,
      type: "user_followed",
    })
    .onConflictDoUpdate({
      target: [notifications.recipientUserId, notifications.actorUserId, notifications.type],
      targetWhere: sql`${notifications.type} = 'user_followed'`,
      set: {
        createdAt: now,
        seenAt: null,
      },
    })
    .returning();

  return notification;
}

export async function getUnseenNotificationCountService(context: AuthenticatedContext) {
  const actor = alias(user, "notification_count_actor");
  const historyCutoff = getNotificationHistoryCutoff();

  const [result] = await context.db
    .select({
      count: sql<number>`count(distinct (${notifications.type}, ${getNotificationGroupIdExpression()}))::int`,
    })
    .from(notifications)
    .innerJoin(actor, eq(notifications.actorUserId, actor.id))
    .where(and(getRenderableNotificationFilter(context.user.id, actor, historyCutoff), isNull(notifications.seenAt)));

  return { count: result?.count ?? 0 };
}

export async function getNotificationsService(data: GetNotificationsInput, context: AuthenticatedContext) {
  const cursor = data.cursor ? decodeNotificationsCursor(data.cursor) : undefined;
  const historyCutoff = getNotificationHistoryCutoff();
  const groupRows = await getNotificationGroupPageRows(context, cursor, historyCutoff);
  const hasNextPage = groupRows.length > notificationPageSize;
  const pageGroupRows = hasNextPage ? groupRows.slice(0, notificationPageSize) : groupRows;
  const lastGroupRow = pageGroupRows.at(-1);
  const hydratedNotificationGroups = await getHydratedNotificationGroups(context, pageGroupRows, historyCutoff);

  return {
    items: mapNotificationGroups(pageGroupRows, hydratedNotificationGroups),
    nextCursor:
      hasNextPage && lastGroupRow
        ? encodeCursor({
            createdAt: formatCursorDate(lastGroupRow.latestCreatedAt),
            id: lastGroupRow.latestNotificationId,
          })
        : null,
  };
}

export async function markNotificationsSeenService(context: AuthenticatedContext) {
  const seenAt = new Date();
  const seenRows = await context.db
    .update(notifications)
    .set({ seenAt })
    .where(
      and(
        eq(notifications.recipientUserId, context.user.id),
        isNull(notifications.seenAt),
        lte(notifications.createdAt, seenAt)
      )
    )
    .returning({ id: notifications.id });

  return { seenCount: seenRows.length };
}

// Helpers

function getRenderableNotificationFilter(
  recipientUserId: string,
  actor: {
    banned: AnyColumn;
    username: AnyColumn;
  },
  historyCutoff: Date
) {
  return and(
    eq(notifications.recipientUserId, recipientUserId),
    gte(notifications.createdAt, historyCutoff),
    isNotNull(actor.username),
    sql`${actor.banned} is not true`,
    or(
      eq(notifications.type, "user_followed"),
      and(
        eq(notifications.type, "review_liked"),
        isNotNull(notifications.reviewId),
        sql`exists(
          select 1
          from ${reviewLikes}
          where ${reviewLikes.reviewId} = ${notifications.reviewId}
            and ${reviewLikes.userId} = ${notifications.actorUserId}
        )`
      )
    )
  );
}

function getUserFollowedNotificationSelect<TActor extends NotificationQueryActorColumns>(actor: TActor) {
  return {
    actor: {
      avatarUrl: actor.image,
      displayUsername: actor.displayUsername,
      id: actor.id,
      username: actor.username,
    },
    createdAt: notifications.createdAt,
    id: notifications.id,
    seenAt: notifications.seenAt,
    type: notifications.type,
  };
}

function getNotificationGroupIdExpression() {
  return sql<string>`case when ${notifications.type} = 'review_liked' then ${notifications.reviewId}::text else ${notifications.id}::text end`;
}

async function getNotificationGroupPageRows(
  context: AuthenticatedContext,
  cursor: NotificationsCursorPayload | undefined,
  historyCutoff: Date
) {
  const actor = alias(user, "notification_group_page_actor");
  const groupIdExpression = getNotificationGroupIdExpression();
  const groupId = groupIdExpression.as("group_id");
  const rankedGroups = context.db
    .selectDistinctOn([groupIdExpression, notifications.type], {
      groupId,
      latestCreatedAt: notifications.createdAt,
      latestNotificationId: notifications.id,
      type: notifications.type,
    })
    .from(notifications)
    .innerJoin(actor, eq(notifications.actorUserId, actor.id))
    .where(getRenderableNotificationFilter(context.user.id, actor, historyCutoff))
    .orderBy(groupIdExpression, notifications.type, desc(notifications.createdAt), desc(notifications.id))
    .as("ranked_notification_groups");
  const cursorFilter = cursor
    ? sql`(${rankedGroups.latestCreatedAt}, ${rankedGroups.latestNotificationId}) < (${cursor.createdAt}::timestamp, ${cursor.id}::uuid)`
    : sql`true`;

  return await context.db
    .select({
      groupId: rankedGroups.groupId,
      latestCreatedAt: rankedGroups.latestCreatedAt,
      latestNotificationId: rankedGroups.latestNotificationId,
      type: rankedGroups.type,
    })
    .from(rankedGroups)
    .where(cursorFilter)
    .orderBy(desc(rankedGroups.latestCreatedAt), desc(rankedGroups.latestNotificationId))
    .limit(notificationPageSize + 1);
}

async function getHydratedNotificationGroups(
  context: AuthenticatedContext,
  groupRows: NotificationGroupPageRow[],
  historyCutoff: Date
) {
  if (groupRows.length === 0) {
    return new Map<string, HydratedNotificationGroup>();
  }

  const reviewIds = [...new Set(groupRows.flatMap((row) => (row.type === "review_liked" ? [row.groupId] : [])))];
  const followNotificationIds = [
    ...new Set(groupRows.flatMap((row) => (row.type === "user_followed" ? [row.groupId] : []))),
  ];
  const [reviewLikedGroups, followRows] = await Promise.all([
    getReviewLikedNotificationGroups(context, reviewIds, historyCutoff),
    getUserFollowedNotificationRows(context, followNotificationIds, historyCutoff),
  ]);
  const hydratedGroups = new Map<string, HydratedNotificationGroup>();

  for (const group of reviewLikedGroups.values()) {
    hydratedGroups.set(group.reviewId, group);
  }

  for (const row of followRows) {
    hydratedGroups.set(row.id, { row, type: "user_followed" });
  }

  return hydratedGroups;
}

async function getReviewLikedNotificationGroups(
  context: AuthenticatedContext,
  reviewIds: string[],
  historyCutoff: Date
) {
  if (reviewIds.length === 0) {
    return new Map<string, ReviewLikedNotificationGroup>();
  }

  const [summaries, actorGroups] = await Promise.all([
    getReviewLikedGroupSummaries(context, reviewIds, historyCutoff),
    getReviewLikedGroupActors(context, reviewIds, historyCutoff),
  ]);

  for (const [reviewId, summary] of summaries) {
    const actors = actorGroups.get(reviewId) ?? [];

    if (actors.length === 0) {
      summaries.delete(reviewId);
      continue;
    }

    summary.actors = actors;
  }

  return summaries;
}

async function getReviewLikedGroupSummaries(context: AuthenticatedContext, reviewIds: string[], historyCutoff: Date) {
  const actor = alias(user, "notification_review_group_summary_actor");
  const rows = await context.db
    .select({
      actorCount: sql<number>`count(*)::int`,
      albumId: albums.id,
      albumTitle: albums.title,
      reviewId: notifications.reviewId,
      seen: sql<boolean>`bool_and(${notifications.seenAt} is not null)`,
    })
    .from(notifications)
    .innerJoin(actor, eq(notifications.actorUserId, actor.id))
    .innerJoin(reviews, eq(notifications.reviewId, reviews.id))
    .innerJoin(albums, eq(reviews.albumId, albums.id))
    .where(
      and(
        getRenderableNotificationFilter(context.user.id, actor, historyCutoff),
        eq(notifications.type, "review_liked"),
        inArray(notifications.reviewId, reviewIds)
      )
    )
    .groupBy(notifications.reviewId, albums.id, albums.title);

  const summaries = new Map<string, ReviewLikedNotificationGroup>();
  for (const row of rows) {
    if (!(row.reviewId && row.albumId && row.albumTitle)) continue;

    summaries.set(row.reviewId, {
      actorCount: row.actorCount,
      actors: [],
      albumId: row.albumId,
      albumTitle: row.albumTitle,
      reviewId: row.reviewId,
      seen: row.seen,
      type: "review_liked",
    });
  }

  return summaries;
}

async function getReviewLikedGroupActors(context: AuthenticatedContext, reviewIds: string[], historyCutoff: Date) {
  const actor = alias(user, "notification_review_group_actor");
  const actorRank = sql<number>`row_number() over (
    partition by ${notifications.reviewId}
    order by ${notifications.createdAt} desc, ${notifications.id} desc
  )`.as("actor_rank");
  const rankedActors = context.db
    .select({
      actorRank,
      avatarUrl: actor.image,
      displayUsername: actor.displayUsername,
      id: actor.id,
      reviewId: notifications.reviewId,
      username: actor.username,
    })
    .from(notifications)
    .innerJoin(actor, eq(notifications.actorUserId, actor.id))
    .where(
      and(
        getRenderableNotificationFilter(context.user.id, actor, historyCutoff),
        eq(notifications.type, "review_liked"),
        inArray(notifications.reviewId, reviewIds)
      )
    )
    .as("ranked_notification_review_group_actors");

  const rows = await context.db
    .select({
      actorRank: rankedActors.actorRank,
      avatarUrl: rankedActors.avatarUrl,
      displayUsername: rankedActors.displayUsername,
      id: rankedActors.id,
      reviewId: rankedActors.reviewId,
      username: rankedActors.username,
    })
    .from(rankedActors)
    .where(sql`${rankedActors.actorRank} <= 3`)
    .orderBy(rankedActors.reviewId, rankedActors.actorRank);

  const actorGroups = new Map<string, NotificationActor[]>();
  for (const row of rows) {
    if (!(row.reviewId && row.username)) continue;

    const actors = actorGroups.get(row.reviewId) ?? [];
    actors.push({
      avatarUrl: row.avatarUrl,
      displayUsername: row.displayUsername,
      id: row.id,
      username: row.username,
    });
    actorGroups.set(row.reviewId, actors);
  }

  return actorGroups;
}

async function getUserFollowedNotificationRows(
  context: AuthenticatedContext,
  notificationIds: string[],
  historyCutoff: Date
) {
  if (notificationIds.length === 0) {
    return [];
  }

  const actor = alias(user, "notification_group_actor");
  const rows = await context.db
    .select(getUserFollowedNotificationSelect(actor))
    .from(notifications)
    .innerJoin(actor, eq(notifications.actorUserId, actor.id))
    .where(
      and(
        getRenderableNotificationFilter(context.user.id, actor, historyCutoff),
        eq(notifications.type, "user_followed"),
        inArray(notifications.id, notificationIds)
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id));

  return normalizeUserFollowedRows(rows);
}

// Mappers

function mapNotificationGroups(
  groupRows: NotificationGroupPageRow[],
  hydratedNotificationGroups: Map<string, HydratedNotificationGroup>
) {
  const items: NotificationItem[] = [];

  for (const groupRow of groupRows) {
    const group = hydratedNotificationGroups.get(groupRow.groupId);
    const item = group ? mapNotificationGroup(groupRow, group) : null;

    if (item) {
      items.push(item);
    }
  }

  return items;
}

function mapNotificationGroup(groupRow: NotificationGroupPageRow, group: HydratedNotificationGroup) {
  if (groupRow.type === "review_liked") {
    return group.type === "review_liked" ? mapReviewLikedGroup(groupRow, group) : null;
  }

  return group.type === "user_followed" ? mapUserFollowedNotification(group.row) : null;
}

function formatCursorDate(value: Date | string) {
  return parseCursorDate(value).toISOString();
}

function parseCursorDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function normalizeUserFollowedRows(rows: UserFollowedNotificationQueryRow[]): UserFollowedNotificationRow[] {
  return rows.flatMap((row) => {
    if (row.type !== "user_followed") return [];
    if (!row.actor.username) return [];

    return [
      {
        ...row,
        actor: {
          ...row.actor,
          username: row.actor.username,
        },
        type: row.type,
      },
    ];
  });
}

function mapReviewLikedGroup(
  groupRow: NotificationGroupPageRow,
  group: ReviewLikedNotificationGroup
): ReviewLikedNotificationItem | null {
  const actors = getDisplayActors(group.actors);
  if (actors.length === 0) {
    return null;
  }

  const latestCreatedAt = parseCursorDate(groupRow.latestCreatedAt);

  return {
    actorCount: group.actorCount,
    actors,
    albumId: group.albumId,
    albumTitle: group.albumTitle,
    href: `/album/${group.albumId}/review/${group.reviewId}`,
    key: `review_liked:${group.reviewId}`,
    latestCreatedAt,
    reviewId: group.reviewId,
    seen: group.seen,
    text: formatReviewLikedText(actors, group.actorCount),
    type: "review_liked",
  };
}

function mapUserFollowedNotification(row: UserFollowedNotificationRow): UserFollowedNotificationItem {
  const actorName = getActorDisplayName(row.actor);

  return {
    actor: row.actor,
    href: `/user/${row.actor.username}`,
    key: `user_followed:${row.id}`,
    latestCreatedAt: row.createdAt,
    seen: Boolean(row.seenAt),
    text: `${actorName} followed you`,
    type: "user_followed",
  };
}

function getDisplayActors(actors: NotificationActor[]) {
  return actors.slice(0, actors.length > 3 ? 2 : 3);
}

function formatReviewLikedText(actors: NotificationActor[], actorCount: number) {
  const actorNames = actors.map(getActorDisplayName);

  if (actorCount === 1) {
    return `${actorNames[0]} liked your review`;
  }

  if (actorCount === 2) {
    return `${actorNames[0]} and ${actorNames[1]} liked your review`;
  }

  if (actorCount === 3) {
    return `${actorNames[0]}, ${actorNames[1]} and ${actorNames[2]} liked your review`;
  }

  return `${actorNames[0]}, ${actorNames[1]} and ${actorCount - 2} others liked your review`;
}

function getActorDisplayName(actor: NotificationActor) {
  return actor.displayUsername ?? actor.username;
}

function getNotificationHistoryCutoff() {
  return new Date(Date.now() - notificationHistoryDays * 24 * 60 * 60 * 1000);
}

// Cursors

function decodeNotificationsCursor(cursor: string): NotificationsCursorPayload {
  return decodeCursor(cursor, notificationsCursorPayloadSchema, "Invalid notifications cursor");
}
