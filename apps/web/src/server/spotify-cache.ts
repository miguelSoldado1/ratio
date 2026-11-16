import { logSpotifyCacheError } from "./spotify-observability";

const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

const EDGE_CACHE_PATH = "/__spotify-cache/";

type CloudflareWorkersModule = typeof import("cloudflare:workers");

// KV writes are capped at 1,000/day; the per-datacenter edge cache is unmetered.
export type SpotifyCacheStorage = "edge" | "kv";

export async function getSpotifyCacheJson(key: string, storage: SpotifyCacheStorage) {
  if (storage === "edge") return await getEdgeCacheJson(key);

  const spotifyCache = await getSpotifyCache();
  if (!spotifyCache) return null;

  try {
    return await spotifyCache.get<unknown>(key, "json");
  } catch (error) {
    logSpotifyCacheError("read_response", error);
    return null;
  }
}

interface SetSpotifyCacheJsonOptions {
  key: string;
  storage: SpotifyCacheStorage;
  ttlSeconds: number;
  value: unknown;
}

export async function setSpotifyCacheJson({ key, storage, ttlSeconds, value }: SetSpotifyCacheJsonOptions) {
  if (storage === "edge") return await setEdgeCacheJson(key, value, ttlSeconds);

  const spotifyCache = await getSpotifyCache();
  if (!spotifyCache) return;

  try {
    await spotifyCache.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch (error) {
    logSpotifyCacheError("write_response", error);
  }
}

export async function getSpotifyCache() {
  const cloudflareWorkers = await getCloudflareWorkersModule();
  return cloudflareWorkers?.env.CACHE ?? null;
}

async function getEdgeCacheJson(key: string) {
  const edgeCacheUrl = await getEdgeCacheUrl(key);
  if (!edgeCacheUrl) return null;

  try {
    const response = await getEdgeCache().match(edgeCacheUrl);
    return response ? await response.json<unknown>() : null;
  } catch (error) {
    logSpotifyCacheError("read_edge_response", error);
    return null;
  }
}

async function setEdgeCacheJson(key: string, value: unknown, ttlSeconds: number) {
  const edgeCacheUrl = await getEdgeCacheUrl(key);
  if (!edgeCacheUrl) return;

  try {
    const response = Response.json(value, { headers: { "Cache-Control": `max-age=${ttlSeconds}` } });
    await getEdgeCache().put(edgeCacheUrl, response);
  } catch (error) {
    logSpotifyCacheError("write_edge_response", error);
  }
}

// Keyed under the app's own origin so entries stay scoped to this environment's zone.
async function getEdgeCacheUrl(key: string) {
  const cloudflareWorkers = await getCloudflareWorkersModule();
  if (!cloudflareWorkers) return null;

  return new URL(`${EDGE_CACHE_PATH}${encodeURIComponent(key)}`, cloudflareWorkers.env.BETTER_AUTH_URL).toString();
}

// The DOM lib's CacheStorage type shadows the Workers one, which adds `default`.
function getEdgeCache() {
  return (caches as unknown as { default: Cache }).default;
}

async function getCloudflareWorkersModule(): Promise<CloudflareWorkersModule | null> {
  if (!isCloudflareWorkersRuntime()) return null;

  try {
    return await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE);
  } catch (error) {
    logSpotifyCacheError("load_bindings", error);
    return null;
  }
}

function isCloudflareWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
