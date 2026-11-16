import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workersEnv = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));

vi.mock("cloudflare:workers", () => workersEnv);

async function importSpotifyCache() {
  vi.resetModules();
  return await import("@/server/spotify-cache");
}

function stubWorkersRuntime({ kv }: { kv: { get: unknown; put: unknown } }) {
  const edgeEntries = new Map<string, Response>();
  const edgeCache = {
    match: vi.fn((url: string) => Promise.resolve(edgeEntries.get(url)?.clone())),
    put: vi.fn((url: string, response: Response) => {
      edgeEntries.set(url, response);
      return Promise.resolve();
    }),
  };

  vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
  vi.stubGlobal("caches", { default: edgeCache });
  workersEnv.env = { BETTER_AUTH_URL: "https://ratio.test", CACHE: kv };

  return edgeCache;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  workersEnv.env = {};
});

describe("edge Spotify cache", () => {
  it("round-trips JSON through the edge cache without touching KV", async () => {
    const kv = { get: vi.fn(), put: vi.fn() };
    const edgeCache = stubWorkersRuntime({ kv });
    const spotifyCache = await importSpotifyCache();

    await spotifyCache.setSpotifyCacheJson({
      key: "spotify:search:v1:radiohead",
      storage: "edge",
      ttlSeconds: 600,
      value: [{ id: "album_1" }],
    });

    await expect(spotifyCache.getSpotifyCacheJson("spotify:search:v1:radiohead", "edge")).resolves.toEqual([
      { id: "album_1" },
    ]);
    const [[url, response]] = edgeCache.put.mock.calls;
    expect(url).toBe("https://ratio.test/__spotify-cache/spotify%3Asearch%3Av1%3Aradiohead");
    expect(response.headers.get("Cache-Control")).toBe("max-age=600");
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("treats an edge cache failure as a miss instead of failing the request", async () => {
    const edgeCache = stubWorkersRuntime({ kv: { get: vi.fn(), put: vi.fn() } });
    edgeCache.match.mockRejectedValue(new Error("cache unavailable"));
    const spotifyCache = await importSpotifyCache();

    await expect(spotifyCache.getSpotifyCacheJson("spotify:search:v1:radiohead", "edge")).resolves.toBeNull();
  });

  it("writes KV entries to KV only", async () => {
    const kv = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
    const edgeCache = stubWorkersRuntime({ kv });
    const spotifyCache = await importSpotifyCache();

    await spotifyCache.setSpotifyCacheJson({
      key: "spotify:album:v1:album_1",
      storage: "kv",
      ttlSeconds: 86_400,
      value: { id: "album_1" },
    });

    expect(kv.put).toHaveBeenCalledWith("spotify:album:v1:album_1", '{"id":"album_1"}', { expirationTtl: 86_400 });
    expect(edgeCache.put).not.toHaveBeenCalled();
  });
});
