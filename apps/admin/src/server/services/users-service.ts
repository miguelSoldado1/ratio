import { user } from "@ratio/database/schema";
import { count } from "drizzle-orm";
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
