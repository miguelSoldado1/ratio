import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/lib/auth";
import type { BetterAuthOptions } from "better-auth";
import type { Db } from "@/lib/db";

const mockBetterAuth = vi.hoisted(() => vi.fn((options: BetterAuthOptions) => ({ options })));

vi.mock("better-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth")>()),
  betterAuth: mockBetterAuth,
}));

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: vi.fn(() => ({ id: "mock-adapter" })),
}));

vi.mock("@/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-better-auth-secret-that-is-long-enough",
    BETTER_AUTH_URL: "https://ratio.test",
    DISCORD_CLIENT_ID: "discord-client-id",
    DISCORD_CLIENT_SECRET: "discord-client-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    SPOTIFY_CLIENT_ID: "spotify-client-id",
    SPOTIFY_CLIENT_SECRET: "spotify-client-secret",
  },
}));

vi.mock("@/server/avatar-storage", () => ({
  deleteAvatarObject: vi.fn(),
}));

vi.mock("@/server/rate-limit", () => ({
  createBetterAuthRateLimitStorage: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock("@/server/spotify-recent-rotation-cache", () => ({
  clearSpotifyRecentRotationCacheForDeletedAccount: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAuth Spotify contract", () => {
  it("requests the v1 scope on every OAuth pass and encrypts provider tokens", () => {
    createAuth({} as Db);
    const options = getCapturedOptions();

    expect(options.socialProviders?.spotify).toEqual(expect.objectContaining({ scope: ["user-read-recently-played"] }));
    expect(options.account?.encryptOAuthTokens).toBe(true);
  });
});

function getCapturedOptions() {
  const options = mockBetterAuth.mock.calls.at(-1)?.[0];
  if (!options) throw new Error("Better Auth options were not captured");

  return options;
}
