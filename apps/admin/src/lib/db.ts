import { createDatabaseAccessor } from "@ratio/database";
import { env } from "@/env";

const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";
type CloudflareWorkersModule = typeof import("cloudflare:workers");

export const getDb = createDatabaseAccessor({
  getDatabaseUrl: () => env.DATABASE_URL,
  getHyperdriveBinding: async () => {
    try {
      const cloudflareWorkers: CloudflareWorkersModule = await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE);
      return cloudflareWorkers.env.HYPERDRIVE;
    } catch {
      return null;
    }
  },
  isCloudflareRuntime: () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers",
});
