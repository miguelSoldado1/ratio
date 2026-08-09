import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAlbumHeadMetadataService } from "@/server/services/album-service";
import { getProfileHeadMetadataService, getReviewHeadMetadataService } from "@/server/services/review-service";

const mocks = vi.hoisted(() => ({
  getAlbumDetailsService: vi.fn(),
  getAlbumPersistenceMetadata: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/server/services/spotify-service", () => ({
  getAlbumDetailsService: mocks.getAlbumDetailsService,
  getAlbumPersistenceMetadata: mocks.getAlbumPersistenceMetadata,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("album head metadata", () => {
  it("uses a local album row without querying Spotify album details", async () => {
    mocks.getDb.mockResolvedValue(
      createSelectDb([
        {
          artistNames: ["Local Artist"],
          coverUrl: null,
          title: "Local Album",
        },
      ])
    );

    await expect(getAlbumHeadMetadataService("local-album")).resolves.toEqual({
      artistNames: ["Local Artist"],
      coverUrl: null,
      title: "Local Album",
    });
    expect(mocks.getAlbumDetailsService).not.toHaveBeenCalled();
  });

  it("uses the shared album-details cache path when no local row exists", async () => {
    mocks.getDb.mockResolvedValue(createSelectDb([]));
    mocks.getAlbumDetailsService.mockResolvedValue({
      album: {
        artists: [
          { id: "artist-a", name: "Primary Artist", spotifyUrl: "https://open.spotify.com/artist/artist-a" },
          { id: "artist-b", name: "Featured Artist", spotifyUrl: "https://open.spotify.com/artist/artist-b" },
        ],
        coverUrl: "https://image.example/album.jpg",
        id: "spotify-album",
        releaseDate: "2026-04-03",
        spotifyUrl: "https://open.spotify.com/album/spotify-album",
        title: "Album",
      },
      tracks: [],
    });

    await expect(getAlbumHeadMetadataService("spotify-album")).resolves.toEqual({
      artistNames: ["Primary Artist", "Featured Artist"],
      coverUrl: "https://image.example/album.jpg",
      title: "Album",
    });
    expect(mocks.getAlbumDetailsService).toHaveBeenCalledWith({ albumId: "spotify-album" });
  });

  it("propagates a Spotify failure so callers do not treat it as a missing album", async () => {
    mocks.getDb.mockResolvedValue(createSelectDb([]));
    mocks.getAlbumDetailsService.mockRejectedValue(new Error("Spotify unavailable"));

    await expect(getAlbumHeadMetadataService("missing-album")).rejects.toThrow("Spotify unavailable");
  });

  it("falls back to Spotify when the local lookup itself fails", async () => {
    mocks.getDb.mockRejectedValue(new Error("Database unavailable"));
    mocks.getAlbumDetailsService.mockResolvedValue({
      album: {
        artists: [{ id: "artist-a", name: "Primary Artist", spotifyUrl: "https://open.spotify.com/artist/artist-a" }],
        coverUrl: null,
        id: "spotify-album",
        releaseDate: "2026-04-03",
        spotifyUrl: "https://open.spotify.com/album/spotify-album",
        title: "Album",
      },
      tracks: [],
    });

    await expect(getAlbumHeadMetadataService("spotify-album")).resolves.toMatchObject({ title: "Album" });
  });
});

describe("profile head metadata", () => {
  it("maps only the public profile fields needed by the head", async () => {
    mocks.getDb.mockResolvedValue(
      createSelectDb([
        {
          avatarUrl: "https://image.example/profile.jpg",
          displayUsername: "Display Name",
          name: "Account Name",
          username: "listener",
        },
      ])
    );

    await expect(getProfileHeadMetadataService({ username: "listener" })).resolves.toEqual({
      avatarUrl: "https://image.example/profile.jpg",
      displayName: "Display Name",
      username: "listener",
    });
  });

  it("falls back to the username when no display name is set", async () => {
    mocks.getDb.mockResolvedValue(
      createSelectDb([{ avatarUrl: null, displayUsername: null, name: "Account Name", username: "listener" }])
    );

    await expect(getProfileHeadMetadataService({ username: "listener" })).resolves.toMatchObject({
      displayName: "listener",
    });
  });

  it("returns null when the public profile is unavailable", async () => {
    mocks.getDb.mockResolvedValue(createSelectDb([]));

    await expect(getProfileHeadMetadataService({ username: "missing" })).resolves.toBeNull();
  });

  it("propagates a database failure so callers do not treat it as a missing profile", async () => {
    mocks.getDb.mockRejectedValue(new Error("Database unavailable"));

    await expect(getProfileHeadMetadataService({ username: "listener" })).rejects.toThrow("Database unavailable");
  });
});

describe("review head metadata", () => {
  it("maps the persisted album, author, and rating without the review body", async () => {
    mocks.getDb.mockResolvedValue(
      createJoinedSelectDb([
        {
          artistNames: ["Primary Artist", "Featured Artist"],
          authorDisplayUsername: "Listener",
          authorName: "Account Name",
          authorUsername: "listener",
          coverUrl: "https://image.example/album.jpg",
          rating: 9,
          title: "The Album",
        },
      ])
    );

    await expect(getReviewHeadMetadataService({ reviewId: "review-id" })).resolves.toEqual({
      artistNames: ["Primary Artist", "Featured Artist"],
      authorDisplayName: "Listener",
      coverUrl: "https://image.example/album.jpg",
      rating: 4.5,
      title: "The Album",
    });
  });

  it("returns null when the public review is unavailable", async () => {
    mocks.getDb.mockResolvedValue(createJoinedSelectDb([]));

    await expect(getReviewHeadMetadataService({ reviewId: "missing" })).resolves.toBeNull();
  });
});

function createSelectDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return { select };
}

function createJoinedSelectDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const innerJoin = vi.fn(() => ({ innerJoin, where }));
  const from = vi.fn(() => ({ innerJoin }));
  const select = vi.fn(() => ({ from }));

  return { select };
}
