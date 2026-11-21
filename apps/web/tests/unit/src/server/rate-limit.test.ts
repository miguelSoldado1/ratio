import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workersEnv = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));

vi.mock("cloudflare:workers", () => workersEnv);

function createRequest() {
  return new Request("https://ratio.test/_serverFn/createReview", {
    headers: { "cf-connecting-ip": "203.0.113.7" },
    method: "POST",
  });
}

function stubWorkersRuntime() {
  vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
}

async function importRateLimit() {
  vi.resetModules();
  return await import("@/server/rate-limit");
}

function getBindingWarnings() {
  return vi
    .mocked(console.warn)
    .mock.calls.map(([message]) => String(message))
    .filter((message) => message.includes("Rate limit binding"));
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  workersEnv.env = {};
});

describe("rate limit binding availability", () => {
  it("stays quiet outside the Workers runtime so local development is not noisy", async () => {
    const rateLimit = await importRateLimit();

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyCatalogRateLimit);
    await rateLimit.enforceFixedWindowRateLimitForRequest(createRequest(), rateLimit.reviewCreateHourlyRateLimit);

    expect(getBindingWarnings()).toEqual([]);
  });

  it("warns when a native limiter binding is unavailable in the Workers runtime", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyCatalogRateLimit);

    expect(getBindingWarnings()).toEqual([
      "Rate limit binding SPOTIFY_CATALOG_RATE_LIMITER is unavailable; requests using it are not being limited",
    ]);
  });

  it("warns when the KV binding backing fixed-window limits is unavailable", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await rateLimit.enforceFixedWindowRateLimitForRequest(createRequest(), rateLimit.reviewCreateHourlyRateLimit);

    expect(getBindingWarnings()).toEqual([
      "Rate limit binding CACHE is unavailable; requests using it are not being limited",
    ]);
  });

  it("warns once per binding instead of once per request", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyCatalogRateLimit);
    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyCatalogRateLimit);
    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyCatalogRateLimit);

    expect(getBindingWarnings()).toHaveLength(1);
  });

  it("warns separately for each distinct missing binding", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyCatalogRateLimit);
    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.contentCreateRateLimit);

    expect(getBindingWarnings()).toHaveLength(2);
  });

  it("still fails open so a missing binding never rejects real traffic", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await expect(
      rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyCatalogRateLimit)
    ).resolves.toBeUndefined();
    await expect(
      rateLimit.enforceFixedWindowRateLimitForRequest(createRequest(), rateLimit.reviewCreateHourlyRateLimit)
    ).resolves.toBeUndefined();
  });
});

describe("fixed-window KV writes", () => {
  it("still allows content creation when KV rejects the write, e.g. after the daily write quota", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();
    const put = vi.fn().mockRejectedValue(new Error("KV put() limit exceeded for the day."));
    workersEnv.env = { CACHE: { get: vi.fn().mockResolvedValue(null), put } };

    await expect(
      rateLimit.enforceFixedWindowRateLimitForRequest(createRequest(), rateLimit.reviewCreateHourlyRateLimit)
    ).resolves.toBeUndefined();
    expect(put).toHaveBeenCalledOnce();
  });
});

describe("Better Auth rate-limit storage", () => {
  const rule = { max: 2, window: 60 };

  function createMemoryCache(initial?: unknown) {
    let stored = initial === undefined ? null : JSON.stringify(initial);
    const put = vi.fn((_key: string, value: string) => {
      stored = value;
      return Promise.resolve();
    });
    const get = vi.fn(() => Promise.resolve(stored === null ? null : JSON.parse(stored)));
    return { get, put };
  }

  it("allows requests up to the limit and blocks the next one with a retry time", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();
    const cache = createMemoryCache();
    workersEnv.env = { CACHE: cache };
    const storage = rateLimit.createBetterAuthRateLimitStorage();

    await expect(storage.consume("ip:/sign-in/social", rule)).resolves.toEqual({ allowed: true, retryAfter: null });
    await expect(storage.consume("ip:/sign-in/social", rule)).resolves.toEqual({ allowed: true, retryAfter: null });

    const blocked = await storage.consume("ip:/sign-in/social", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(rule.window);
    expect(cache.put).toHaveBeenCalledTimes(2);
  });

  it("starts a new window once the previous one has elapsed", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();
    const cache = createMemoryCache({ count: rule.max, windowStart: Date.now() - (rule.window + 1) * 1000 });
    workersEnv.env = { CACHE: cache };

    await expect(rateLimit.createBetterAuthRateLimitStorage().consume("ip:/callback/spotify", rule)).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
    expect(JSON.parse(cache.put.mock.calls[0]?.[1] ?? "{}")).toMatchObject({ count: 1 });
  });

  it("still allows sign-in when KV rejects the write", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();
    workersEnv.env = {
      CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockRejectedValue(new Error("KV put() limit")) },
    };

    await expect(rateLimit.createBetterAuthRateLimitStorage().consume("ip:/sign-in/social", rule)).resolves.toEqual({
      allowed: true,
      retryAfter: null,
    });
  });
});
