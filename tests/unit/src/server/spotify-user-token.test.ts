import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/lib/auth";
import {
  getSpotifyUserAccessToken,
  SpotifyAuthorizationRequiredError,
  SpotifyReconnectRequiredError,
} from "@/server/spotify-user-token";
import type { Db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  createAuth: vi.fn(),
}));

const mockCreateAuth = vi.mocked(createAuth);
const mockGetAccessToken = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateAuth.mockReturnValue({
    api: { getAccessToken: mockGetAccessToken },
  } as unknown as ReturnType<typeof createAuth>);
});

describe("getSpotifyUserAccessToken", () => {
  it("throws authorization-required when no Spotify account is linked", async () => {
    const db = createMockDb([]);

    await expect(getSpotifyUserAccessToken(db, "user_1")).rejects.toBeInstanceOf(SpotifyAuthorizationRequiredError);
    expect(mockGetAccessToken).not.toHaveBeenCalled();
  });

  it("throws reconnect-required when the recently-played scope is missing", async () => {
    const db = createMockDb([{ accountId: "spotify_account", scope: "user-read-email" }]);

    await expect(getSpotifyUserAccessToken(db, "user_1")).rejects.toBeInstanceOf(SpotifyReconnectRequiredError);
    expect(mockGetAccessToken).not.toHaveBeenCalled();
  });

  it("returns the access token for a granted account", async () => {
    const db = createMockDb([{ accountId: "spotify_account", scope: "user-read-email,user-read-recently-played" }]);
    mockGetAccessToken.mockResolvedValue({ accessToken: "user-access-token" });

    await expect(getSpotifyUserAccessToken(db, "user_1")).resolves.toBe("user-access-token");
    expect(mockGetAccessToken).toHaveBeenCalledWith({
      body: {
        accountId: "spotify_account",
        providerId: "spotify",
        userId: "user_1",
      },
    });
  });

  it("requires reconnect when token retrieval or refresh fails without retrying", async () => {
    const db = createMockDb([{ accountId: "spotify_account", scope: "user-read-recently-played" }]);
    mockGetAccessToken.mockRejectedValue(new Error("Failed to get a valid access token"));

    await expect(getSpotifyUserAccessToken(db, "user_1")).rejects.toBeInstanceOf(SpotifyReconnectRequiredError);
    expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
  });
});

function createMockDb(accountRows: { accountId: string; scope: string | null }[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(accountRows)),
        })),
      })),
    })),
  } as unknown as Db;
}
