import { beforeEach, describe, expect, it, vi } from "vitest";

const tokenNow = new Date("2026-07-06T10:00:00.000Z").getTime();

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(tokenNow);
});

describe("getClientCredentialsToken", () => {
  it("reuses a fresh in-memory token", async () => {
    const { clientCredentialsGrant, getClientCredentialsToken } = await importSpotifyModule();
    clientCredentialsGrant.mockResolvedValue({
      body: {
        access_token: "fresh-token",
        expires_in: 3600,
      },
    });

    await expect(getClientCredentialsToken()).resolves.toBe("fresh-token");
    await expect(getClientCredentialsToken()).resolves.toBe("fresh-token");

    expect(clientCredentialsGrant).toHaveBeenCalledTimes(1);
  });

  it("reuses a fresh KV token", async () => {
    const { clientCredentialsGrant, getClientCredentialsToken, kvGet } = await importSpotifyModule({
      cachedToken: {
        accessToken: "kv-token",
        expiresAt: tokenNow + 60 * 60 * 1000,
      },
    });

    await expect(getClientCredentialsToken()).resolves.toBe("kv-token");

    expect(kvGet).toHaveBeenCalledWith("spotify:client-credentials-token", "json");
    expect(clientCredentialsGrant).not.toHaveBeenCalled();
  });

  it("refreshes expired or near-expired tokens", async () => {
    const { clientCredentialsGrant, getClientCredentialsToken } = await importSpotifyModule({
      cachedToken: {
        accessToken: "near-expired-token",
        expiresAt: tokenNow + 4 * 60 * 1000,
      },
    });
    clientCredentialsGrant.mockResolvedValue({
      body: {
        access_token: "refreshed-token",
        expires_in: 3600,
      },
    });

    await expect(getClientCredentialsToken()).resolves.toBe("refreshed-token");
  });

  it("tolerates KV read and write failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { clientCredentialsGrant, getClientCredentialsToken, kvGet, kvPut } = await importSpotifyModule({
      failGet: true,
      failPut: true,
    });
    clientCredentialsGrant.mockResolvedValue({
      body: {
        access_token: "fallback-token",
        expires_in: 3600,
      },
    });

    await expect(getClientCredentialsToken()).resolves.toBe("fallback-token");

    expect(kvGet).toHaveBeenCalled();
    expect(kvPut).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

async function importSpotifyModule({
  cachedToken = null,
  failGet = false,
  failPut = false,
}: {
  cachedToken?: unknown;
  failGet?: boolean;
  failPut?: boolean;
} = {}) {
  const clientCredentialsGrant = vi.fn();
  const kvGet = vi.fn(() => {
    if (failGet) return Promise.reject(new Error("KV get failed"));
    return Promise.resolve(cachedToken);
  });
  const kvPut = vi.fn(() => {
    if (failPut) return Promise.reject(new Error("KV put failed"));
    return Promise.resolve();
  });

  vi.doMock("spotify-web-api-node", () => ({
    default: vi.fn(function SpotifyWebApi() {
      return {
        clientCredentialsGrant,
        setAccessToken: vi.fn(),
      };
    }),
  }));

  vi.doMock("@/env", () => ({
    env: {
      SPOTIFY_CLIENT_ID: "client-id",
      SPOTIFY_CLIENT_SECRET: "client-secret",
    },
  }));

  vi.doMock("@/server/spotify-cache", () => ({
    getSpotifyCache: vi.fn(async () => ({
      get: kvGet,
      put: kvPut,
    })),
  }));

  const spotify = await import("@/server/spotify");

  return {
    clientCredentialsGrant,
    getClientCredentialsToken: spotify.getClientCredentialsToken,
    kvGet,
    kvPut,
  };
}
