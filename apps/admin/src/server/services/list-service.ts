import { albums, listItems, lists, user } from "@ratio/database/schema";
import { and, asc, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { toFiniteNumber } from "@/lib/format";
import { buildQueryParams, buildSortingClause } from "../table-query";
import type { getDb } from "@/lib/db";
import type { TableQueryConfig, TableQueryInput, TableQueryResult } from "../table-query";

// Constants

const sortColumns = {
  createdAt: lists.createdAt,
  title: lists.title,
  updatedAt: lists.updatedAt,
} as const;

const filterColumns = {
  createdAt: lists.createdAt,
} as const;

const listTableConfig: TableQueryConfig<typeof sortColumns, typeof filterColumns> = {
  sortColumns,
  filterColumns,
  dateColumns: new Set(["createdAt"]),
};

const WHITESPACE_REGEX = /\s+/;
const listUserIdentity = sql<string>`coalesce(${user.displayUsername}, ${user.username}, ${user.name})`;
const listItemCount = sql<number>`(
  select count(*) from ${listItems}
  where ${listItems.listId} = ${lists.id}
)`.mapWith(Number);
const listCoverUrl = sql<string | null>`(
  select ${albums.coverUrl} from ${listItems}
  inner join ${albums} on ${albums.id} = ${listItems.albumId}
  where ${listItems.listId} = ${lists.id}
  order by ${listItems.position}
  limit 1
)`;

// Types

export interface AdminListContext {
  db: Awaited<ReturnType<typeof getDb>>;
}

export interface GetTableListsInput extends TableQueryInput {}

export interface AdminListTablePage extends TableQueryResult<AdminListRow> {}

export interface AdminListStats {
  newLast7Days: number;
  newLast30Days: number;
  newPrev7Days: number;
  newPrev30Days: number;
  totalListItems: number;
  totalLists: number;
}

export interface AdminListRow {
  coverUrl: string | null;
  createdAt: Date;
  description: string | null;
  id: string;
  isRanked: boolean;
  itemCount: number;
  title: string;
  updatedAt: Date;
  userDisplayUsername: string | null;
  userId: string;
  userImage: string | null;
  userName: string;
  username: string | null;
}

// Services

export async function getTableListsService(data: GetTableListsInput, context: AdminListContext) {
  const { title: titleFilter, user: userFilter, ...filters } = data.filters;
  const nonUserSorting = data.sorting.filter((sort) => sort.id !== "user");
  const queryParams = buildQueryParams({ ...data, filters, sorting: nonUserSorting }, listTableConfig);
  const titleOrDescriptionFilterCondition = buildTitleOrDescriptionFilterCondition(titleFilter);
  const userFilterCondition = buildUserFilterCondition(userFilter);
  const whereClause = and(queryParams.whereClause, titleOrDescriptionFilterCondition, userFilterCondition);
  const orderBy = data.sorting.flatMap((sort) => {
    if (sort.id === "user") {
      return [sort.desc ? desc(listUserIdentity) : asc(listUserIdentity)];
    }

    return buildSortingClause([sort], sortColumns);
  });
  const baseQuery = context.db
    .select({
      coverUrl: listCoverUrl,
      createdAt: lists.createdAt,
      description: lists.description,
      id: lists.id,
      isRanked: lists.isRanked,
      itemCount: listItemCount,
      title: lists.title,
      updatedAt: lists.updatedAt,
      userDisplayUsername: user.displayUsername,
      userId: user.id,
      userImage: user.image,
      userName: user.name,
      username: user.username,
    })
    .from(lists)
    .innerJoin(user, eq(lists.userId, user.id));
  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const sortedQuery = orderBy.length > 0 ? filteredQuery.orderBy(...orderBy) : filteredQuery;

  const totalQuery = context.db.select({ count: count() }).from(lists).innerJoin(user, eq(lists.userId, user.id));
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

export async function getListStatsService(context: AdminListContext): Promise<AdminListStats> {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const last7Start = new Date(now - 7 * dayMs);
  const prev7Start = new Date(now - 14 * dayMs);
  const last30Start = new Date(now - 30 * dayMs);
  const prev30Start = new Date(now - 60 * dayMs);

  const [[stats], [itemStats]] = await Promise.all([
    context.db
      .select({
        newLast7Days: count(sql`case when ${gte(lists.createdAt, last7Start)} then 1 end`),
        newLast30Days: count(sql`case when ${gte(lists.createdAt, last30Start)} then 1 end`),
        newPrev7Days: count(
          sql`case when ${and(gte(lists.createdAt, prev7Start), lt(lists.createdAt, last7Start))} then 1 end`
        ),
        newPrev30Days: count(
          sql`case when ${and(gte(lists.createdAt, prev30Start), lt(lists.createdAt, last30Start))} then 1 end`
        ),
        totalLists: count(),
      })
      .from(lists),
    context.db.select({ totalListItems: count() }).from(listItems),
  ]);

  return {
    newLast7Days: toFiniteNumber(stats.newLast7Days),
    newLast30Days: toFiniteNumber(stats.newLast30Days),
    newPrev7Days: toFiniteNumber(stats.newPrev7Days),
    newPrev30Days: toFiniteNumber(stats.newPrev30Days),
    totalListItems: toFiniteNumber(itemStats.totalListItems),
    totalLists: toFiniteNumber(stats.totalLists),
  };
}

function buildTitleOrDescriptionFilterCondition(value: TableQueryInput["filters"][string]) {
  return buildMultiFieldTextCondition(value, (term) =>
    or(ilike(lists.title, `%${term}%`), ilike(lists.description, `%${term}%`))
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

export async function deleteListService(listId: string, context: AdminListContext) {
  const [deletedList] = await context.db.delete(lists).where(eq(lists.id, listId)).returning({ id: lists.id });

  if (!deletedList) {
    throw new Error("List not found");
  }

  return deletedList;
}
