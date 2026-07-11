import * as schema from "@ratio/database/schema";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: "../../.env", quiet: true });

const unsafeDatabaseNames = new Set(["postgres", "ratio", "template0", "template1"]);
const expectedMigrationNoticeCodes = new Set(["42P06", "42P07"]);
const testTables = [
  '"notification"',
  '"profile_pinned_review"',
  '"review_like"',
  '"user_follow"',
  '"review"',
  '"album"',
  '"session"',
  '"account"',
  '"verification"',
  '"user"',
];

const testClient = postgres(getSafeTestDatabaseUrl(), {
  max: 1,
  onnotice(notice) {
    if (expectedMigrationNoticeCodes.has(notice.code)) return;
    console.log(notice);
  },
  prepare: false,
});

export const testDb = drizzle({ client: testClient, schema });

export async function migrateTestDatabase() {
  await migrate(testDb, { migrationsFolder: "../../drizzle" });
}

export async function cleanTestDatabase() {
  await testDb.execute(sql.raw(`truncate table ${testTables.join(", ")} restart identity cascade`));
}

export async function closeTestDatabase() {
  await testClient.end();
}

function getSafeTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_TEST_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_TEST_URL is required for DB integration tests. Example: postgres://.../ratio_test");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_TEST_URL must be a valid Postgres connection URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("DATABASE_TEST_URL must use the postgres:// or postgresql:// protocol.");
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "");
  const normalizedDatabaseName = databaseName.toLowerCase();

  if (!(normalizedDatabaseName.includes("test") && !unsafeDatabaseNames.has(normalizedDatabaseName))) {
    throw new Error('Refusing to run DB integration tests: DATABASE_TEST_URL database name must include "test".');
  }

  return databaseUrl;
}
