import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createRequest() {
  return new Request("https://ratio.test/_serverFn/createReview", {
    headers: { "cf-connecting-ip": "203.0.113.7" },
    method: "POST",
  });
}

function stubWorkersRuntime() {
  vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
}

// Each test imports its own module instance so the warn-once state starts empty, the way it does in a
// fresh Worker isolate.
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
});

describe("rate limit binding availability", () => {
  it("stays quiet outside the Workers runtime so local development is not noisy", async () => {
    const rateLimit = await importRateLimit();

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifySearchRateLimit);
    await rateLimit.enforceFixedWindowRateLimitForRequest(createRequest(), rateLimit.reviewCreateHourlyRateLimit);

    expect(getBindingWarnings()).toEqual([]);
  });

  it("warns when a native limiter binding is unavailable in the Workers runtime", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifySearchRateLimit);

    expect(getBindingWarnings()).toEqual([
      "Rate limit binding SPOTIFY_SEARCH_RATE_LIMITER is unavailable; requests using it are not being limited",
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

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifySearchRateLimit);
    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifySearchRateLimit);
    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifySearchRateLimit);

    expect(getBindingWarnings()).toHaveLength(1);
  });

  it("warns separately for each distinct missing binding", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifySearchRateLimit);
    await rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifyAlbumDetailsRateLimit);

    expect(getBindingWarnings()).toHaveLength(2);
  });

  it("still fails open so a missing binding never rejects real traffic", async () => {
    const rateLimit = await importRateLimit();
    stubWorkersRuntime();

    await expect(
      rateLimit.enforceCloudflareRateLimitForRequest(createRequest(), rateLimit.spotifySearchRateLimit)
    ).resolves.toBeUndefined();
    await expect(
      rateLimit.enforceFixedWindowRateLimitForRequest(createRequest(), rateLimit.reviewCreateHourlyRateLimit)
    ).resolves.toBeUndefined();
  });
});
