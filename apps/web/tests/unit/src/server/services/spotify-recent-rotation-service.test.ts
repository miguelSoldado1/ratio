import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMyRecentRotationService,
  mapRecentlyPlayedToRotationAlbums,
} from "@/server/services/spotify-recent-rotation-service";
import { createSpotifyApi } from "@/server/spotify";
import { getSpotifyCacheJson, setSpotifyCacheJson } from "@/server/spotify-cache";
import {
  getSpotifyUserAccessToken,
  SpotifyAuthorizationRequiredError,
  SpotifyReconnectRequiredError,
} from "@/server/spotify-user-token";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "@/server/auth-middleware";

vi.mock("@/server/spotify", () => ({
  createSpotifyApi: vi.fn(),
}));

vi.mock("@/server/spotify-cache", () => ({
  deleteSpotifyCacheJson: vi.fn(),
  getSpotifyCacheJson: vi.fn(),
  setSpotifyCacheJson: vi.fn(),
}));

vi.mock("@/server/spotify-user-token", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/spotify-user-token")>()),
  getSpotifyUserAccessToken: vi.fn(),
}));

const mockCreateSpotifyApi = vi.mocked(createSpotifyApi);
const mockGetSpotifyCacheJson = vi.mocked(getSpotifyCacheJson);
const mockSetSpotifyCacheJson = vi.mocked(setSpotifyCacheJson);
const mockGetSpotifyUserAccessToken = vi.mocked(getSpotifyUserAccessToken);
const db = {} as Db;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockGetSpotifyUserAccessToken.mockResolvedValue("user-access-token");
  mockGetSpotifyCacheJson.mockResolvedValue(null);
  mockSetSpotifyCacheJson.mockResolvedValue(undefined);
});

describe("getMyRecentRotationService", () => {
  it("returns a cached rotation without calling Spotify", async () => {
    const cachedResponse = {
      albums: [createRotationAlbum({ id: "cached_album" })],
      refreshedAt: "2026-07-10T10:00:00.000Z",
    };
    mockGetSpotifyCacheJson.mockResolvedValue(cachedResponse);

    await expect(getMyRecentRotationService(createContext())).resolves.toEqual({ status: "ready", ...cachedResponse });
    expect(mockCreateSpotifyApi).not.toHaveBeenCalled();
  });

  it.each([
    [new SpotifyAuthorizationRequiredError(), "authorization-required"],
    [new SpotifyReconnectRequiredError(), "reconnect-required"],
  ])("does not read cached data when token access fails with %s", async (error, status) => {
    mockGetSpotifyUserAccessToken.mockRejectedValue(error);

    await expect(getMyRecentRotationService(createContext())).resolves.toEqual({ status });
    expect(mockGetSpotifyCacheJson).not.toHaveBeenCalled();
  });

  it("fetches, normalizes, and caches a rotation on a cache miss", async () => {
    const getMyRecentlyPlayedTracks = vi.fn().mockResolvedValue({
      body: { items: [createPlayHistoryItem({ albumId: "album_1" })] },
    });
    mockCreateSpotifyApi.mockReturnValue(createMockSpotifyApi({ getMyRecentlyPlayedTracks }));

    const response = await getMyRecentRotationService(createContext());

    expect(getMyRecentlyPlayedTracks).toHaveBeenCalledWith({ limit: 50 });
    expect(response).toEqual(
      expect.objectContaining({ albums: [expect.objectContaining({ id: "album_1" })], status: "ready" })
    );
    expect(mockSetSpotifyCacheJson).toHaveBeenCalledWith(
      "spotify:recent-rotation:user_1",
      expect.objectContaining({ albums: [expect.objectContaining({ id: "album_1" })] }),
      1800
    );
  });

  it.each([
    [{ statusCode: 401 }, "reconnect-required"],
    [{ statusCode: 429 }, "rate-limited"],
    [{ statusCode: 502 }, "unavailable"],
  ])("does not cache an upstream failure: %s", async (spotifyError, status) => {
    const getMyRecentlyPlayedTracks = vi.fn().mockRejectedValue(spotifyError);
    mockCreateSpotifyApi.mockReturnValue(createMockSpotifyApi({ getMyRecentlyPlayedTracks }));

    await expect(getMyRecentRotationService(createContext())).resolves.toEqual({ status });
    expect(mockSetSpotifyCacheJson).not.toHaveBeenCalled();
  });
});

describe("mapRecentlyPlayedToRotationAlbums", () => {
  it("keeps full albums, deduplicates to the newest play, and orders the result", () => {
    const albums = mapRecentlyPlayedToRotationAlbums(
      createPlayHistoryItems([
        createPlayHistoryItem({ albumId: "older", playedAt: "2026-07-10T08:00:00.000Z" }),
        createPlayHistoryItem({ albumId: "newest", playedAt: "2026-07-10T11:00:00.000Z" }),
        createPlayHistoryItem({ albumId: "older", playedAt: "2026-07-10T10:00:00.000Z" }),
        createPlayHistoryItem({ albumId: "single", albumType: "single" }),
        createPlayHistoryItem({ albumId: "compilation", albumType: "compilation" }),
      ])
    );

    expect(albums).toEqual([
      expect.objectContaining({
        id: "newest",
        spotifyUrl: "https://open.spotify.com/album/newest",
      }),
      expect.objectContaining({ id: "older", lastPlayedAt: "2026-07-10T10:00:00.000Z" }),
    ]);
  });

  it("ignores malformed plays and returns at most six albums", () => {
    const validItems = Array.from({ length: 8 }, (_, index) =>
      createPlayHistoryItem({ albumId: `album_${index}`, playedAt: `2026-07-10T0${index}:00:00.000Z` })
    );
    const albums = mapRecentlyPlayedToRotationAlbums(
      createPlayHistoryItems([
        ...validItems,
        createPlayHistoryItem({ albumId: "", playedAt: "2026-07-10T10:00:00.000Z" }),
        { played_at: "not-a-date" },
      ])
    );

    expect(albums).toHaveLength(6);
    expect(albums[0]?.id).toBe("album_7");
  });
});

function createContext(userId = "user_1"): AuthenticatedContext {
  return { db, user: { id: userId, isAdmin: false } };
}

function createMockSpotifyApi(overrides: Record<string, unknown>) {
  return overrides as unknown as ReturnType<typeof createSpotifyApi>;
}

function createPlayHistoryItems(items: Record<string, unknown>[]) {
  return items as unknown as SpotifyApi.PlayHistoryObject[];
}

function createPlayHistoryItem({
  albumId,
  albumType = "album",
  playedAt = "2026-07-10T10:00:00.000Z",
}: {
  albumId: string;
  albumType?: string;
  playedAt?: string;
}) {
  return {
    played_at: playedAt,
    track: {
      album: {
        album_type: albumType,
        artists: [{ id: "artist_1", name: "Artist One" }],
        id: albumId,
        images: [{ height: 640, url: "https://img.large", width: 640 }],
        name: "Album Name",
      },
    },
  };
}

function createRotationAlbum(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    artistNames: ["Artist One"],
    coverUrl: "https://img.large",
    id: "album_1",
    lastPlayedAt: "2026-07-10T10:00:00.000Z",
    spotifyUrl: "https://open.spotify.com/album/album_1",
    title: "Album Name",
    ...overrides,
  };
}
