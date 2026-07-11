import { and, asc, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import z from "zod";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export interface TableQueryConfig<
  TSortColumns extends Record<string, PgColumn>,
  TFilterColumns extends Record<string, PgColumn> = TSortColumns,
> {
  booleanColumns?: Set<string>;
  dateColumns?: Set<string>;
  dateRangeColumns?: Set<string>;
  enumColumns?: Set<string>;
  exactColumns?: Set<string>;
  filterColumns: TFilterColumns;
  numberColumns?: Set<string>;
  rangeColumns?: Set<string>;
  sortColumns: TSortColumns;
  textColumns?: Set<string>;
}

export interface TableQueryInput {
  filters: Record<string, string | number | (string | number)[]>;
  limit: number;
  page: number;
  sorting: Array<{ id: string; desc: boolean }>;
}

export interface TableQueryResult<TData> {
  data: TData[];
  pageCount: number;
}

export interface QueryParams {
  limit: number;
  offset: number;
  orderBy: SQL<unknown>[];
  whereClause?: SQL<unknown>;
}

type FilterValue = string | number | (string | number)[];

const DIGITS_ONLY_REGEX = /^\d+$/;
const NON_DIGIT_REGEX = /\D+/;
const WHITESPACE_REGEX = /\s+/;

function parseDate(value: string | number): Date | null {
  let date: Date;
  if (typeof value === "number") {
    date = new Date(value);
  } else if (DIGITS_ONLY_REGEX.test(value)) {
    date = new Date(Number.parseInt(value, 10));
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildSortingClause<T extends Record<string, PgColumn>>(
  sorting: Array<{ id: string; desc: boolean }>,
  sortColumns: T
) {
  return sorting
    .map((sort) => {
      const column = sortColumns[sort.id];
      if (!column) return null;
      return sort.desc ? desc(column) : asc(column);
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function toNumericValues(value: FilterValue): number[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
      .filter((v) => Number.isFinite(v));
  }
  if (typeof value === "string") {
    return value
      .split(NON_DIGIT_REGEX)
      .filter(Boolean)
      .map((part) => Number.parseInt(part, 10))
      .filter((v) => Number.isFinite(v));
  }
  return Number.isFinite(value) ? [value] : [];
}

function buildNumberCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  const numericValues = toNumericValues(value);
  if (numericValues.length === 0) return null;
  if (numericValues.length === 1) return eq(column, numericValues[0]);
  return or(...numericValues.map((v) => eq(column, v))) ?? null;
}

function buildDateCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  if (Array.isArray(value)) {
    const conditions = value
      .map((v) => {
        const date = parseDate(v);
        return date ? gte(column, date) : null;
      })
      .filter((cond): cond is NonNullable<typeof cond> => cond !== null);
    return conditions.length > 0 ? (or(...conditions) ?? null) : null;
  }

  const date = parseDate(value);
  if (!date) return null;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return and(gte(column, startOfDay), lte(column, endOfDay)) ?? null;
}

function buildDateRangeCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  if (!(Array.isArray(value) && value.length === 2)) return null;

  const [min, max] = value.map((v) => parseDate(v)).filter((d): d is Date => d !== null);
  if (!(min && max)) return null;

  const endOfDay = new Date(max);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return and(gte(column, min), lte(column, endOfDay)) ?? null;
}

function buildRangeCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  if (Array.isArray(value) && value.length === 2) {
    const [min, max] = value.map((v) => Number(v));
    if (Number.isNaN(min) || Number.isNaN(max)) return null;
    return and(gte(column, min), lte(column, max)) ?? null;
  }

  const numValue = Number(value);
  return Number.isNaN(numValue) ? null : gte(column, numValue);
}

function buildEnumCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return or(...value.map((v) => eq(column, v))) ?? null;
  }
  return eq(column, value);
}

function buildBooleanCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  const values = (Array.isArray(value) ? value : [value]).flatMap((item) => {
    const normalized = String(item).trim().toLowerCase();
    if (normalized === "true") return [true];
    if (normalized === "false") return [false];
    return [];
  });

  if (values.length === 0) return null;

  const conditions = values.map((item) => (item ? eq(column, true) : or(eq(column, false), isNull(column))));
  return or(...conditions) ?? null;
}

function buildExactCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return or(...value.map((v) => ilike(column, String(v)))) ?? null;
  }
  return ilike(column, String(value));
}

function buildTextCondition(column: PgColumn, value: FilterValue): SQL<unknown> | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return or(...value.map((v) => ilike(column, `%${String(v)}%`))) ?? null;
  }

  const searchTerms = String(value).trim().split(WHITESPACE_REGEX).filter(Boolean);
  if (searchTerms.length === 0) return null;
  if (searchTerms.length === 1) return ilike(column, `%${searchTerms[0]}%`);
  return and(...searchTerms.map((term) => ilike(column, `%${term}%`))) ?? null;
}

type FilterConfig = Pick<
  TableQueryConfig<Record<string, PgColumn>>,
  | "filterColumns"
  | "booleanColumns"
  | "dateColumns"
  | "dateRangeColumns"
  | "textColumns"
  | "rangeColumns"
  | "numberColumns"
  | "exactColumns"
  | "enumColumns"
>;

function buildCondition(config: FilterConfig, key: string, column: PgColumn, value: FilterValue): SQL<unknown> | null {
  if (config.booleanColumns?.has(key)) return buildBooleanCondition(column, value);
  if (config.numberColumns?.has(key)) return buildNumberCondition(column, value);
  if (config.dateColumns?.has(key)) return buildDateCondition(column, value);
  if (config.dateRangeColumns?.has(key)) return buildDateRangeCondition(column, value);
  if (config.rangeColumns?.has(key)) return buildRangeCondition(column, value);
  if (config.enumColumns?.has(key)) return buildEnumCondition(column, value);
  if (config.exactColumns?.has(key)) return buildExactCondition(column, value);
  return buildTextCondition(column, value);
}

export function buildFilterConditions<T extends Record<string, PgColumn>>(
  filters: Record<string, FilterValue>,
  config: Pick<
    TableQueryConfig<Record<string, PgColumn>, T>,
    | "filterColumns"
    | "booleanColumns"
    | "dateColumns"
    | "dateRangeColumns"
    | "textColumns"
    | "rangeColumns"
    | "numberColumns"
    | "exactColumns"
    | "enumColumns"
  >
): SQL<unknown>[] {
  const whereConditions: SQL<unknown>[] = [];

  for (const [key, value] of Object.entries(filters)) {
    const column = config.filterColumns[key];
    if (!(column && value)) continue;

    const condition = buildCondition(config, key, column, value);
    if (condition) {
      whereConditions.push(condition);
    }
  }

  return whereConditions;
}

export function buildQueryParams<
  TSortColumns extends Record<string, PgColumn>,
  TFilterColumns extends Record<string, PgColumn>,
>(input: TableQueryInput, config: TableQueryConfig<TSortColumns, TFilterColumns>): QueryParams {
  const offset = (input.page - 1) * input.limit;
  const orderBy = buildSortingClause(input.sorting, config.sortColumns);
  const whereConditions = buildFilterConditions(input.filters, config);
  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  return {
    whereClause,
    orderBy,
    limit: input.limit,
    offset,
  };
}

export const getTableDataInput = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sorting: z
    .array(z.object({ id: z.string(), desc: z.boolean() }))
    .optional()
    .default([]),
  filters: z
    .record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]))
    .optional()
    .default({}),
});
