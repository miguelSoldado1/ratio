import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

type CloudflareWorkersModule = typeof import("cloudflare:workers");
type PostgresClient = ReturnType<typeof postgres>;

let localDb: Db | undefined;

export async function getDb() {
  if (isCloudflareWorkersRuntime()) {
    return createDrizzleClient(postgres(await getHyperdriveDatabaseUrl(), { max: 1, prepare: false }));
  }

  localDb ??= createLocalDb();

  return localDb;
}

function createDrizzleClient(client: PostgresClient) {
  return drizzle({ client, schema });
}

function createLocalDb() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for local database access");
  }

  return createDrizzleClient(postgres(env.DATABASE_URL, { max: 1, prepare: false }));
}

async function getHyperdriveDatabaseUrl() {
  const hyperdrive = await getHyperdriveBinding();

  if (!hyperdrive) {
    throw new Error("HYPERDRIVE binding is required for Cloudflare Worker database access");
  }

  return hyperdrive.connectionString;
}

async function getHyperdriveBinding() {
  try {
    const cloudflareWorkers: CloudflareWorkersModule = await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE);
    return cloudflareWorkers.env.HYPERDRIVE;
  } catch {
    return null;
  }
}

function isCloudflareWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export type Db = ReturnType<typeof createDrizzleClient>;
