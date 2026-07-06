import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAlbumDetailsService,
  getAlbumPersistenceMetadata,
  searchAlbumsService,
} from "@/server/services/spotify-service";
import { createSpotifyApi, getClientCredentialsToken } from "@/server/spotify";
import { getSpotifyCacheJson, setSpotifyCacheJson } from "@/server/spotify-cache";

vi.mock("@/server/spotify", () => ({
  createSpotifyApi: vi.fn(),
  getClientCredentialsToken: vi.fn(),
}));

vi.mock("@/server/spotify-cache", () => ({
  getSpotifyCacheJson: vi.fn(),
  setSpotifyCacheJson: vi.fn(),
}));

const mockCreateSpotifyApi = vi.mocked(createSpotifyApi);
const mockGetClientCredentialsToken = vi.mocked(getClientCredentialsToken);
const mockGetSpotifyCacheJson = vi.mocked(getSpotifyCacheJson);
const mockSetSpotifyCacheJson = vi.mocked(setSpotifyCacheJson);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClientCredentialsToken.mockResolvedValue("access-token");
  mockGetSpotifyCacheJson.mockResolvedValue(null);
  mockSetSpotifyCacheJson.mockResolvedValue(undefined);
});

describe("searchAlbumsService", () => {
  it("maps album search results and filters non-albums", async () => {
    const spotifyApi = createMockSpotifyApi({
      searchAlbums: vi.fn().mockResolvedValue({
        body: {
          albums: {
            items: [
              createSpotifyAlbum({ album_type: "album", id: "album_1", name: "First Album" }),
              createSpotifyAlbum({ album_type: "single", id: "single_1", name: "Single" }),
            ],
          },
        },
      }),
    });
    mockCreateSpotifyApi.mockReturnValue(spotifyApi);

    await expect(searchAlbumsService({ query: " First   Album " })).resolves.toEqual([
      {
        albumType: "album",
        artists: [{ id: "artist_1", name: "Artist One" }],
        id: "album_1",
        image: "https://img.small",
        name: "First Album",
        releaseDate: "2026-01-02",
        spotifyUrl: "https://open.spotify.com/album/album_1",
      },
    ]);
    expect(spotifyApi.searchAlbums).toHaveBeenCalledWith("first album", { limit: 10, market: "US" });
  });

  it("uses valid cached search results without calling Spotify", async () => {
    mockGetSpotifyCacheJson.mockResolvedValue([
      {
        albumType: "album",
        artists: [{ id: "artist_1", name: "Artist One" }],
        id: "cached_album",
        image: null,
        name: "Cached Album",
        releaseDate: "2026-01-02",
        spotifyUrl: "https://open.spotify.com/album/cached_album",
      },
    ]);

    await expect(searchAlbumsService({ query: "cached" })).resolves.toEqual([
      expect.objectContaining({ id: "cached_album" }),
    ]);
    expect(mockCreateSpotifyApi).not.toHaveBeenCalled();
  });

  it("ignores invalid cached search results and refetches", async () => {
    const spotifyApi = createMockSpotifyApi({
      searchAlbums: vi.fn().mockResolvedValue({
        body: { albums: { items: [createSpotifyAlbum({ id: "fresh_album" })] } },
      }),
    });
    mockGetSpotifyCacheJson.mockResolvedValueOnce([{ albumType: "single", id: "invalid" }]).mockResolvedValueOnce(null);
    mockCreateSpotifyApi.mockReturnValue(spotifyApi);

    await expect(searchAlbumsService({ query: "fresh" })).resolves.toEqual([
      expect.objectContaining({ id: "fresh_album" }),
    ]);
    expect(spotifyApi.searchAlbums).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, "Spotify rate limit reached, try again shortly"],
    [401, "Spotify authentication failed"],
    [400, "Invalid Spotify album ID"],
    [404, "Spotify album not found"],
    [500, "Spotify search failed"],
  ])("maps status %s errors to user-facing messages", async (statusCode, message) => {
    const spotifyApi = createMockSpotifyApi({
      searchAlbums: vi.fn().mockRejectedValue({ statusCode }),
    });
    mockCreateSpotifyApi.mockReturnValue(spotifyApi);

    await expect(searchAlbumsService({ query: "error" })).rejects.toThrow(message);
  });
});

describe("getAlbumDetailsService", () => {
  it("maps album, tracks, artists, images, and duration fields", async () => {
    const spotifyApi = createMockSpotifyApi({
      getAlbum: vi.fn().mockResolvedValue({
        body: createSpotifyAlbumDetails({
          tracks: {
            items: [createSpotifyTrack({ duration_ms: 1000, id: "track_1" })],
            total: 2,
          },
        }),
      }),
      getAlbumTracks: vi.fn().mockResolvedValue({
        body: {
          items: [createSpotifyTrack({ duration_ms: 2500, id: "track_2", name: "Track Two", track_number: 2 })],
        },
      }),
    });
    mockCreateSpotifyApi.mockReturnValue(spotifyApi);

    await expect(getAlbumDetailsService({ albumId: "album_1" })).resolves.toMatchObject({
      album: {
        artists: [{ id: "artist_1", name: "Artist One", spotifyUrl: "https://open.spotify.com/artist/artist_1" }],
        coverUrl: "https://img.large",
        durationMs: 3500,
        id: "album_1",
        spotifyUrl: "https://open.spotify.com/album/album_1",
        title: "Album Details",
      },
      tracks: [
        expect.objectContaining({
          durationMs: 1000,
          id: "track_1",
          spotifyUrl: "https://open.spotify.com/track/track_1",
        }),
        expect.objectContaining({ durationMs: 2500, id: "track_2", title: "Track Two" }),
      ],
    });
  });

  it("rejects non-album details", async () => {
    const spotifyApi = createMockSpotifyApi({
      getAlbum: vi.fn().mockResolvedValue({
        body: createSpotifyAlbumDetails({ album_type: "single" }),
      }),
    });
    mockCreateSpotifyApi.mockReturnValue(spotifyApi);

    await expect(getAlbumDetailsService({ albumId: "single_1" })).rejects.toThrow("Only albums are supported");
  });

  it("uses valid cached album details without calling Spotify", async () => {
    mockGetSpotifyCacheJson.mockResolvedValue(createCachedAlbumDetails({ albumId: "cached_album" }));

    await expect(getAlbumDetailsService({ albumId: "cached_album" })).resolves.toMatchObject({
      album: { id: "cached_album" },
    });
    expect(mockCreateSpotifyApi).not.toHaveBeenCalled();
  });
});

describe("getAlbumPersistenceMetadata", () => {
  it("prefers cached album details", async () => {
    mockGetSpotifyCacheJson.mockResolvedValue(
      createCachedAlbumDetails({ albumId: "cached_album", releaseDate: "1998-05-01" })
    );

    await expect(getAlbumPersistenceMetadata("cached_album")).resolves.toEqual({
      artistNames: ["Artist One"],
      coverUrl: "https://cached.cover",
      id: "cached_album",
      releaseYear: 1998,
      title: "Cached Album",
      totalTracks: 2,
    });
    expect(mockCreateSpotifyApi).not.toHaveBeenCalled();
  });

  it("fetches persistence metadata when no cached details exist", async () => {
    const spotifyApi = createMockSpotifyApi({
      getAlbum: vi.fn().mockResolvedValue({
        body: createSpotifyAlbumDetails({ id: "fetched_album", release_date: "2001-09-01" }),
      }),
    });
    mockCreateSpotifyApi.mockReturnValue(spotifyApi);

    await expect(getAlbumPersistenceMetadata("fetched_album")).resolves.toEqual({
      artistNames: ["Artist One"],
      coverUrl: "https://img.large",
      id: "fetched_album",
      releaseYear: 2001,
      title: "Album Details",
      totalTracks: 2,
    });
  });

  it("rejects non-album persistence lookup", async () => {
    const spotifyApi = createMockSpotifyApi({
      getAlbum: vi.fn().mockResolvedValue({
        body: createSpotifyAlbumDetails({ album_type: "single" }),
      }),
    });
    mockCreateSpotifyApi.mockReturnValue(spotifyApi);

    await expect(getAlbumPersistenceMetadata("single_1")).rejects.toThrow("Only albums are supported");
  });
});

function createMockSpotifyApi(overrides: Record<string, unknown>) {
  return overrides as unknown as ReturnType<typeof createSpotifyApi>;
}

function createSpotifyAlbum(overrides: Record<string, unknown> = {}) {
  return {
    album_type: "album",
    artists: [{ id: "artist_1", name: "Artist One" }],
    id: "album_1",
    images: [
      { height: 640, url: "https://img.large", width: 640 },
      { height: 64, url: "https://img.small", width: 64 },
    ],
    name: "Album Name",
    release_date: "2026-01-02",
    total_tracks: 2,
    ...overrides,
  };
}

function createSpotifyAlbumDetails(overrides: Record<string, unknown> = {}) {
  return {
    ...createSpotifyAlbum({ id: "album_1", name: "Album Details" }),
    genres: ["rock"],
    label: "Label",
    tracks: {
      items: [createSpotifyTrack()],
      total: 1,
    },
    ...overrides,
  };
}

function createSpotifyTrack(overrides: Record<string, unknown> = {}) {
  return {
    disc_number: 1,
    duration_ms: 1000,
    id: "track_1",
    name: "Track One",
    preview_url: null,
    track_number: 1,
    ...overrides,
  };
}

function createCachedAlbumDetails({ albumId, releaseDate = "2026-01-02" }: { albumId: string; releaseDate?: string }) {
  return {
    album: {
      albumType: "album",
      artists: [{ id: "artist_1", name: "Artist One", spotifyUrl: "https://open.spotify.com/artist/artist_1" }],
      coverUrl: "https://cached.cover",
      durationMs: 3500,
      genre: "rock",
      id: albumId,
      label: "Label",
      releaseDate,
      spotifyUrl: `https://open.spotify.com/album/${albumId}`,
      title: "Cached Album",
      totalTracks: 2,
    },
    tracks: [
      {
        discNumber: 1,
        durationMs: 3500,
        id: "cached_track",
        previewUrl: null,
        spotifyUrl: "https://open.spotify.com/track/cached_track",
        title: "Cached Track",
        trackNumber: 1,
      },
    ],
  };
}
