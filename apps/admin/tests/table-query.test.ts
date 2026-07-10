import { user } from "@ratio/database/schema";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildFilterConditions, buildQueryParams, buildSortingClause, getTableDataInput } from "@/server/table-query";

const dialect = new PgDialect();

describe("table query", () => {
  it("builds pagination and ignores unknown sort columns", () => {
    const params = buildQueryParams(
      {
        filters: {},
        limit: 20,
        page: 3,
        sorting: [
          { id: "createdAt", desc: true },
          { id: "unknown", desc: false },
        ],
      },
      {
        filterColumns: { email: user.email },
        sortColumns: { createdAt: user.createdAt },
      }
    );

    expect(params).toMatchObject({ limit: 20, offset: 40 });
    expect(params.orderBy).toHaveLength(1);
  });

  it("ignores unknown filters and parameterizes text filters", () => {
    const conditions = buildFilterConditions(
      { email: "listener@example.com", unknown: "ignored" },
      {
        filterColumns: { email: user.email },
        textColumns: new Set(["email"]),
      }
    );

    expect(conditions).toHaveLength(1);
    const query = dialect.sqlToQuery(conditions[0]);
    expect(query.sql).toContain("ilike");
    expect(query.params).toEqual(["%listener@example.com%"]);
  });

  it("builds only configured sorting expressions", () => {
    const sorting = buildSortingClause(
      [
        { id: "name", desc: false },
        { id: "role", desc: true },
      ],
      { name: user.name }
    );

    expect(sorting).toHaveLength(1);
    expect(dialect.sqlToQuery(sorting[0]).sql).toContain('"user"."name" asc');
  });

  it("validates table input bounds and applies defaults", () => {
    expect(getTableDataInput.parse({})).toEqual({ filters: {}, limit: 10, page: 1, sorting: [] });
    expect(getTableDataInput.safeParse({ limit: 101, page: 1 }).success).toBe(false);
    expect(getTableDataInput.safeParse({ limit: 10, page: 0 }).success).toBe(false);
  });
});
