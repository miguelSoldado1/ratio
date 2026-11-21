declare global {
  interface CacheStorage {
    readonly default: Cache;
  }
}

export function getEdgeCache() {
  if (typeof caches === "undefined" || !("default" in caches)) return null;
  return caches.default;
}
