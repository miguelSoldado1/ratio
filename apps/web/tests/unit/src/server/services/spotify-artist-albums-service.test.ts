import { beforeEach, describe, expect, it, vi } from "vitest";
import { getArtistAlbumsService } from "@/server/services/spotify-service";
import { createSpotifyApi, getClientCredentialsToken } from "@/server/spotify";
import { getSpotifyCacheJson, setSpotifyCacheJson } from "@/server/spotify-cache";

vi.mock("@/server/spotify", () => ({ createSpotifyApi: vi.fn(), getClientCredentialsToken: vi.fn() }));
vi.mock("@/server/spotify-cache", () => ({ getSpotifyCacheJson: vi.fn(), setSpotifyCacheJson: vi.fn() }));

const cacheKey = "spotify:artist-albums:global-v1:artist_1";
const values = new Map<string, unknown>();
const getArtistAlbums = vi.fn();

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  values.clear();
  for (const id of ["current", "other"]) {
    values.set(`spotify:album-persistence:global-v1:${id}`, createAlbumMetadata({ id, title: id }));
  }
  vi.mocked(getSpotifyCacheJson).mockImplementation((key) => Promise.resolve(values.get(key) ?? null));
  vi.mocked(setSpotifyCacheJson).mockImplementation((key, value) => {
    values.set(key, value);
    return Promise.resolve();
  });
  getArtistAlbums.mockReset().mockResolvedValue({ body: { items: [createAlbum()] } });
  vi.mocked(getClientCredentialsToken).mockResolvedValue("token");
  vi.mocked(createSpotifyApi).mockReturnValue({ getArtistAlbums } as unknown as ReturnType<typeof createSpotifyApi>);
});

describe("getArtistAlbumsService", () => {
  it("fetches full albums, deduplicates advisory editions, and caches the list for a week", async () => {
    getArtistAlbums.mockResolvedValue({
      body: {
        items: [
          createAlbum(),
          createAlbum({ id: "clean", name: " Album Name (Clean) " }),
          createAlbum({ album_type: "single", id: "single" }),
          createAlbum({ id: "other", name: "Other Album" }),
        ],
      },
    });

    await expect(getArtistAlbumsService({ albumId: "current", artistId: "artist_1" })).resolves.toEqual([
      {
        id: "album_1",
        title: "Album Name",
        releaseYear: "2007",
        coverUrl: "https://img.large",
        spotifyUrl: "https://open.spotify.com/album/album_1",
      },
      expect.objectContaining({ id: "other" }),
    ]);
    expect(getArtistAlbums).toHaveBeenCalledExactlyOnceWith("artist_1", { include_groups: "album", limit: 10 });
    expect(setSpotifyCacheJson).toHaveBeenCalledWith(cacheKey, expect.any(Array), 604_800);
  });

  it("serves later album pages for the same artist from the shared cache", async () => {
    await getArtistAlbumsService({ albumId: "current", artistId: "artist_1" });
    await getArtistAlbumsService({ albumId: "other", artistId: "artist_1" });

    expect(getArtistAlbums).toHaveBeenCalledOnce();
  });

  it("excludes the current album and caps the shelf at four", async () => {
    getArtistAlbums.mockResolvedValue({
      body: { items: ["current", "one", "two", "three", "four", "five"].map((id) => createAlbum({ id, name: id })) },
    });

    const albums = await getArtistAlbumsService({ albumId: "current", artistId: "artist_1" });

    expect(albums.map((album) => album.id)).toEqual(["one", "two", "three", "four"]);
  });

  it("excludes the kept edition when the current album is the edition dedupe dropped", async () => {
    values.set(
      "spotify:album-persistence:global-v1:clean",
      createAlbumMetadata({ id: "clean", title: "Album Name (Clean)" })
    );
    getArtistAlbums.mockResolvedValue({
      body: {
        items: [
          createAlbum(),
          createAlbum({ id: "clean", name: "Album Name (Clean)" }),
          createAlbum({ id: "other", name: "Other" }),
        ],
      },
    });

    const albums = await getArtistAlbumsService({ albumId: "clean", artistId: "artist_1" });

    expect(albums.map((album) => album.id)).toEqual(["other"]);
  });

  it("hides the shelf when the current album's edition cannot be resolved", async () => {
    values.delete("spotify:album-persistence:global-v1:current");
    values.set(cacheKey, [
      { id: "other", title: "Other", releaseYear: "2007", coverUrl: null, spotifyUrl: "", editionKey: "other" },
    ]);
    vi.mocked(createSpotifyApi).mockReturnValue({
      getAlbum: vi.fn().mockRejectedValue(new Error("Service unavailable")),
      getArtistAlbums,
    } as unknown as ReturnType<typeof createSpotifyApi>);

    await expect(getArtistAlbumsService({ albumId: "current", artistId: "artist_1" })).resolves.toEqual([]);
    expect(getArtistAlbums).not.toHaveBeenCalled();
  });

  it("returns an empty shelf and logs when Spotify fails", async () => {
    getArtistAlbums.mockRejectedValue(Object.assign(new Error("Service unavailable"), { statusCode: 503 }));

    await expect(getArtistAlbumsService({ albumId: "current", artistId: "artist_1" })).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "spotify_api_error",
      expect.objectContaining({ operation: "artist_albums", status: 503 })
    );
  });
});

function createAlbum(overrides: Record<string, unknown> = {}) {
  return {
    album_type: "album",
    artists: [{ id: "artist_1", name: "Artist One" }],
    id: "album_1",
    images: [{ url: "https://img.large", width: 640, height: 640 }],
    name: "Album Name",
    release_date: "2007-10-10",
    total_tracks: 10,
    ...overrides,
  };
}

function createAlbumMetadata(overrides: Record<string, unknown>) {
  return {
    artistNames: ["Artist One"],
    coverUrl: null,
    id: "album_1",
    releaseDate: "2007-10-10",
    title: "Album Name",
    totalTracks: 10,
    ...overrides,
  };
}
