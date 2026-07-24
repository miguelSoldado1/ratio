import { describe, expect, it, vi } from "vitest";
import { applyAdminAuthRateLimit } from "@/server/rate-limit";

const sha256HexPattern = /^[0-9a-f]{64}$/;

function createRateLimiter(success: boolean) {
  return { limit: vi.fn(() => Promise.resolve({ success })) } as unknown as RateLimit;
}

function createAuthRequest(headers: Record<string, string> = {}) {
  return new Request("https://admin.ratio.test/api/auth/sign-in/social", { headers, method: "POST" });
}

describe("admin auth rate limit", () => {
  it("lets an allowed request through", async () => {
    const response = await applyAdminAuthRateLimit(createAuthRequest(), createRateLimiter(true));

    expect(response).toBeNull();
  });

  it("answers a denied request with 429 and Retry-After", async () => {
    const response = await applyAdminAuthRateLimit(createAuthRequest(), createRateLimiter(false));

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("60");
  });

  it("keys on the client ip without leaking it into the key", async () => {
    const rateLimiter = createRateLimiter(true);
    await applyAdminAuthRateLimit(createAuthRequest({ "cf-connecting-ip": "203.0.113.7" }), rateLimiter);

    const [{ key }] = vi.mocked(rateLimiter.limit).mock.calls[0];
    expect(key).toMatch(sha256HexPattern);
    expect(key).not.toContain("203.0.113.7");
  });

  it("separates callers by ip and collapses unknown callers", async () => {
    const rateLimiter = createRateLimiter(true);

    await applyAdminAuthRateLimit(createAuthRequest({ "cf-connecting-ip": "203.0.113.7" }), rateLimiter);
    await applyAdminAuthRateLimit(createAuthRequest({ "x-forwarded-for": "203.0.113.8, 70.41.3.18" }), rateLimiter);
    await applyAdminAuthRateLimit(createAuthRequest(), rateLimiter);
    await applyAdminAuthRateLimit(createAuthRequest(), rateLimiter);

    const keys = vi.mocked(rateLimiter.limit).mock.calls.map(([{ key }]) => key);
    expect(new Set(keys).size).toBe(3);
    expect(keys[2]).toBe(keys[3]);
  });

  it("prefers cf-connecting-ip over forwarded headers", async () => {
    const rateLimiter = createRateLimiter(true);

    await applyAdminAuthRateLimit(createAuthRequest({ "cf-connecting-ip": "203.0.113.7" }), rateLimiter);
    await applyAdminAuthRateLimit(
      createAuthRequest({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }),
      rateLimiter
    );

    const [first, second] = vi.mocked(rateLimiter.limit).mock.calls.map(([{ key }]) => key);
    expect(first).toBe(second);
  });
});
