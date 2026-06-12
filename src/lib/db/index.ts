import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
// biome-ignore lint/performance/noNamespaceImport: Better Auth's Drizzle adapter expects a schema namespace object.
import * as schema from "./schema";

export function createDbClient() {
  const client = postgres(env.DATABASE_URL, { max: 1, prepare: false });

  return {
    client,
    db: drizzle({ client, schema }),
  };
}

export type Db = ReturnType<typeof createDbClient>["db"];
