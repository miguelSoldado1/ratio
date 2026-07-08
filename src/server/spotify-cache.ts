import { logSpotifyCacheError } from "./spotify-observability";

const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

type CloudflareWorkersModule = typeof import("cloudflare:workers");

export async function getSpotifyCacheJson(key: string) {
  const spotifyCache = await getSpotifyCache();
  if (!spotifyCache) return null;

  try {
    return await spotifyCache.get<unknown>(key, "json");
  } catch (error) {
    logSpotifyCacheError("read_response", error);
    return null;
  }
}

export async function setSpotifyCacheJson(key: string, value: unknown, ttlSeconds: number) {
  const spotifyCache = await getSpotifyCache();
  if (!spotifyCache) return;

  try {
    await spotifyCache.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch (error) {
    logSpotifyCacheError("write_response", error);
  }
}

export async function getSpotifyCache() {
  if (!isCloudflareWorkersRuntime()) return null;

  try {
    const cloudflareWorkers: CloudflareWorkersModule = await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE);
    return cloudflareWorkers.env.CACHE;
  } catch (error) {
    logSpotifyCacheError("load_bindings", error);
    return null;
  }
}

function isCloudflareWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
