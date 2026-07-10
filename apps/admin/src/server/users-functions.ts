import { user } from "@ratio/database/schema";
import { createServerFn } from "@tanstack/react-start";
import { count } from "drizzle-orm";
import { requireAdminMiddleware } from "./admin-middleware";
import { buildQueryParams, getTableDataInput, type TableQueryConfig } from "./table-query";

const SORT_COLUMNS = {
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
} as const;

const FILTER_COLUMNS = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
} as const;

const CONFIG: TableQueryConfig<typeof SORT_COLUMNS, typeof FILTER_COLUMNS> = {
  sortColumns: SORT_COLUMNS,
  filterColumns: FILTER_COLUMNS,
  dateColumns: new Set(["createdAt"]),
  // role is a comma-separated list ("user,admin"), so it filters via ilike too
  textColumns: new Set(["id", "name", "email", "role"]),
} as const;

const USER_TABLE_COLUMNS = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  role: user.role,
  banned: user.banned,
  createdAt: user.createdAt,
} as const;

export type AdminUserRow = Pick<typeof user.$inferSelect, keyof typeof USER_TABLE_COLUMNS>;

export const getTableUsers = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(getTableDataInput)
  .handler(async ({ context, data }) => {
    const queryParams = buildQueryParams(data, CONFIG);

    const baseQuery = context.db.select(USER_TABLE_COLUMNS).from(user);
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
  });
