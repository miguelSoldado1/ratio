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

  it("derives identity from the Spotify display name when one is set", async () => {
    expect(await mapSpotifyProfileToUser({ display_name: "Maya Chen" })).toEqual({
      displayUsername: "Maya Chen",
      username: "maya_chen",
    });
  });

  it("falls back to the account id when Spotify returns no display name", async () => {
    expect(await mapSpotifyProfileToUser({ display_name: null })).toEqual({
      displayUsername: "user_1234abcd",
      username: "user_1234abcd",
    });

    expect(await mapSpotifyProfileToUser({ display_name: "   " })).toEqual({
      displayUsername: "user_1234abcd",
      username: "user_1234abcd",
    });
  });
});

async function mapSpotifyProfileToUser({ display_name }: { display_name: null | string }) {
  createAuth(createAvailableUsernameDbStub());
  const spotifyProvider = getCapturedOptions().socialProviders?.spotify;

  if (typeof spotifyProvider === "function" || !spotifyProvider?.mapProfileToUser) {
    throw new Error("Spotify mapProfileToUser was not configured");
  }

  const { mapProfileToUser } = spotifyProvider;

  const profile = {
    display_name,
    email: "listener@ratio.test",
    id: "spotifyuser1234abcd",
    images: [],
  };

  return await mapProfileToUser(profile as unknown as Parameters<typeof mapProfileToUser>[0]);
}

function createAvailableUsernameDbStub() {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  } as unknown as Db;
}

function getCapturedOptions() {
  const options = mockBetterAuth.mock.calls.at(-1)?.[0];
  if (!options) throw new Error("Better Auth options were not captured");

  return options;
}
