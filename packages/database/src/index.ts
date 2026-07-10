import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

interface HyperdriveBinding {
  connectionString: string;
}

interface DatabaseAccessorOptions {
  getDatabaseUrl: () => string | undefined;
  getHyperdriveBinding: () => Promise<HyperdriveBinding | null>;
  isCloudflareRuntime: () => boolean;
}

type PostgresClient = ReturnType<typeof postgres>;

export function createDatabaseAccessor(options: DatabaseAccessorOptions) {
  let localDb: Db | undefined;

  return async function getDb() {
    if (options.isCloudflareRuntime()) {
      const hyperdrive = await options.getHyperdriveBinding();

      if (!hyperdrive) {
        throw new Error("HYPERDRIVE binding is required for Cloudflare Worker database access");
      }

      return createDrizzleClient(postgres(hyperdrive.connectionString, { fetch_types: false, max: 1, prepare: true }));
    }

    const databaseUrl = options.getDatabaseUrl();

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for local database access");
    }

    localDb ??= createDrizzleClient(postgres(databaseUrl, { max: 1, prepare: false }));
    return localDb;
  };
}

function createDrizzleClient(client: PostgresClient) {
  return drizzle({ client, schema });
}

export type Db = ReturnType<typeof createDrizzleClient>;
