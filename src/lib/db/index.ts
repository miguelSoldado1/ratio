import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

export function createDbClient() {
  const client = postgres(env.DATABASE_URL, { max: 1, prepare: false });

  return {
    client,
    db: drizzle({ client, schema }),
  };
}

export type Db = ReturnType<typeof createDbClient>["db"];
