import { user } from "@ratio/database/schema";
import { and, count, gte, lt, sql } from "drizzle-orm";
import { buildQueryParams, type TableQueryConfig, type TableQueryInput, type TableQueryResult } from "../table-query";
import type { getDb } from "@/lib/db";

// Constants

const sortColumns = {
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
} as const;

const filterColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
} as const;

const userTableConfig: TableQueryConfig<typeof sortColumns, typeof filterColumns> = {
  sortColumns,
  filterColumns,
  dateColumns: new Set(["createdAt"]),
  // role is a comma-separated list ("user,admin"), so it filters via ilike too
  textColumns: new Set(["id", "name", "email", "role"]),
} as const;

const userTableColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  role: user.role,
  banned: user.banned,
  createdAt: user.createdAt,
} as const;

// Types

export interface AdminUserContext {
  db: Awaited<ReturnType<typeof getDb>>;
}

export interface GetTableUsersInput extends TableQueryInput {}

export interface AdminUserTablePage extends TableQueryResult<AdminUserRow> {}

export type AdminUserRow = Pick<typeof user.$inferSelect, keyof typeof userTableColumns>;

export interface AdminUserStats {
  bannedUsers: number;
  newLast7Days: number;
  newLast30Days: number;
  newPrev7Days: number;
  newPrev30Days: number;
  totalUsers: number;
}

// Services

export async function getTableUsersService(data: GetTableUsersInput, context: AdminUserContext) {
  const queryParams = buildQueryParams(data, userTableConfig);
  const baseQuery = context.db.select(userTableColumns).from(user);
  const filteredQuery = queryParams.whereClause ? baseQuery.where(queryParams.whereClause) : baseQuery;
  const sortedQuery = queryParams.orderBy.length > 0 ? filteredQuery.orderBy(...queryParams.orderBy) : filteredQuery;

  const [rows, totalCount] = await Promise.all([
    sortedQuery.limit(queryParams.limit).offset(queryParams.offset),
    context.db.select({ count: count() }).from(user).where(queryParams.whereClause),
  ]);

  return {
    data: rows,
    pageCount: Math.ceil(totalCount[0].count / queryParams.limit),
  };
}

export async function getUserStatsService(context: AdminUserContext): Promise<AdminUserStats> {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const last7Start = new Date(now - 7 * dayMs);
  const prev7Start = new Date(now - 14 * dayMs);
  const last30Start = new Date(now - 30 * dayMs);
  const prev30Start = new Date(now - 60 * dayMs);

  // Single round trip: conditional counts over one pass of the user table
  const [stats] = await context.db
    .select({
      totalUsers: count(),
      newLast7Days: count(sql`case when ${gte(user.createdAt, last7Start)} then 1 end`),
      newPrev7Days: count(
        sql`case when ${and(gte(user.createdAt, prev7Start), lt(user.createdAt, last7Start))} then 1 end`
      ),
      newLast30Days: count(sql`case when ${gte(user.createdAt, last30Start)} then 1 end`),
      newPrev30Days: count(
        sql`case when ${and(gte(user.createdAt, prev30Start), lt(user.createdAt, last30Start))} then 1 end`
      ),
      bannedUsers: count(sql`case when ${user.banned} then 1 end`),
    })
    .from(user);

  return stats;
}
