import { describe, expect, it, vi } from "vitest";
import { applyAdminRequestRateLimit } from "@/server/rate-limit";

const sha256HexPattern = /^[0-9a-f]{64}$/;

function createRateLimiter(success: boolean) {
  return { limit: vi.fn(() => Promise.resolve({ success })) } as unknown as RateLimit;
}

function createAdminRequest(headers: Record<string, string> = {}, pathname = "/_serverFn/getTableUsers") {
  return new Request(`https://admin.ratio.test${pathname}`, { headers, method: "POST" });
}

describe("admin request rate limit", () => {
  it("lets an allowed request through", async () => {
    const response = await applyAdminRequestRateLimit(createAdminRequest(), createRateLimiter(true));

    expect(response).toBeNull();
  });

  it("answers a denied request with 429 and Retry-After", async () => {
    const response = await applyAdminRequestRateLimit(createAdminRequest(), createRateLimiter(false));

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("60");
    expect(response?.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("shares one budget across auth routes and server functions", async () => {
    const rateLimiter = createRateLimiter(true);
    const headers = { "cf-connecting-ip": "203.0.113.7" };

    await applyAdminRequestRateLimit(createAdminRequest(headers, "/api/auth/sign-in/social"), rateLimiter);
    await applyAdminRequestRateLimit(createAdminRequest(headers, "/_serverFn/getTableUsers"), rateLimiter);

    const [authKey, serverFnKey] = vi.mocked(rateLimiter.limit).mock.calls.map(([{ key }]) => key);
    expect(authKey).toBe(serverFnKey);
  });

  it("keys on the client ip without leaking it into the key", async () => {
    const rateLimiter = createRateLimiter(true);
    await applyAdminRequestRateLimit(createAdminRequest({ "cf-connecting-ip": "203.0.113.7" }), rateLimiter);

    const [{ key }] = vi.mocked(rateLimiter.limit).mock.calls[0];
    expect(key).toMatch(sha256HexPattern);
    expect(key).not.toContain("203.0.113.7");
  });

  it("separates callers by ip and collapses unknown callers", async () => {
    const rateLimiter = createRateLimiter(true);

    await applyAdminRequestRateLimit(createAdminRequest({ "cf-connecting-ip": "203.0.113.7" }), rateLimiter);
    await applyAdminRequestRateLimit(createAdminRequest({ "x-forwarded-for": "203.0.113.8, 70.41.3.18" }), rateLimiter);
    await applyAdminRequestRateLimit(createAdminRequest(), rateLimiter);
    await applyAdminRequestRateLimit(createAdminRequest(), rateLimiter);

    const keys = vi.mocked(rateLimiter.limit).mock.calls.map(([{ key }]) => key);
    expect(new Set(keys).size).toBe(3);
    expect(keys[2]).toBe(keys[3]);
  });

  it("prefers cf-connecting-ip over forwarded headers", async () => {
    const rateLimiter = createRateLimiter(true);

    await applyAdminRequestRateLimit(createAdminRequest({ "cf-connecting-ip": "203.0.113.7" }), rateLimiter);
    await applyAdminRequestRateLimit(
      createAdminRequest({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }),
      rateLimiter
    );

    const [first, second] = vi.mocked(rateLimiter.limit).mock.calls.map(([{ key }]) => key);
    expect(first).toBe(second);
  });
});
