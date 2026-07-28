import { listItems, lists, reviewReplies } from "@ratio/database/schema";
import { and, count, gte, lt, sql } from "drizzle-orm";
import { toFiniteNumber } from "@/lib/format";
import { getReviewStatsService } from "./review-service";
import { getUserStatsService } from "./user-service";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { getDb } from "@/lib/db";

export interface AdminOverviewContext {
  db: Awaited<ReturnType<typeof getDb>>;
}

interface GetPeriodStatsProps {
  context: AdminOverviewContext;
  createdAt: PgColumn;
  last30Start: Date;
  prev30Start: Date;
  table: PgTable;
}

export async function getOverviewStatsService(context: AdminOverviewContext) {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const last30Start = new Date(now - 30 * dayMs);
  const prev30Start = new Date(now - 60 * dayMs);

  const periodStatsDefaults = { context, last30Start, prev30Start };

  const [userStats, reviewStats, replyStats, listStats, listItemStats] = await Promise.all([
    getUserStatsService(context),
    getReviewStatsService(context),
    getPeriodStats({ ...periodStatsDefaults, createdAt: reviewReplies.createdAt, table: reviewReplies }),
    getPeriodStats({ ...periodStatsDefaults, createdAt: lists.createdAt, table: lists }),
    getPeriodStats({ ...periodStatsDefaults, createdAt: listItems.createdAt, table: listItems }),
  ]);

  return {
    listItemsLast30Days: listItemStats.current,
    listItemsPrev30Days: listItemStats.previous,
    listsLast30Days: listStats.current,
    listsPrev30Days: listStats.previous,
    repliesLast30Days: replyStats.current,
    repliesPrev30Days: replyStats.previous,
    reviewsLast30Days: reviewStats.newLast30Days,
    reviewsPrev30Days: reviewStats.newPrev30Days,
    totalUsers: userStats.totalUsers,
    usersLast30Days: userStats.newLast30Days,
    usersPrev30Days: userStats.newPrev30Days,
  };
}

async function getPeriodStats({ context, createdAt, last30Start, prev30Start, table }: GetPeriodStatsProps) {
  const [stats] = await context.db
    .select({
      current: count(sql`case when ${gte(createdAt, last30Start)} then 1 end`),
      previous: count(sql`case when ${and(gte(createdAt, prev30Start), lt(createdAt, last30Start))} then 1 end`),
    })
    .from(table);

  return {
    current: toFiniteNumber(stats.current),
    previous: toFiniteNumber(stats.previous),
  };
}
