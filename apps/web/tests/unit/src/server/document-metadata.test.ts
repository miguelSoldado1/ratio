import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchDocumentMetadataRoute, resolveDocumentMetadata } from "@/server/document-metadata";

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getAlbumPersistenceMetadata: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/server/rate-limit", () => ({
  enforceCloudflareRateLimitForRequest: mocks.enforceRateLimit,
  spotifyCatalogRateLimit: { bindingName: "SPOTIFY_CATALOG_RATE_LIMITER" },
}));
vi.mock("@/server/services/spotify-service", () => ({
  getAlbumPersistenceMetadata: mocks.getAlbumPersistenceMetadata,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("document metadata route matching", () => {
  it("matches only supported public document paths", () => {
    expect(matchDocumentMetadataRoute("/album/album-a")).toEqual({ albumId: "album-a", kind: "album" });
    expect(matchDocumentMetadataRoute("/user/listener")).toEqual({ kind: "profile", username: "listener" });
    expect(matchDocumentMetadataRoute("/review/8ad8b676-8e99-4d4a-8e99-95a56fe78c5a")).toEqual({
      kind: "review",
      reviewId: "8ad8b676-8e99-4d4a-8e99-95a56fe78c5a",
    });
    expect(matchDocumentMetadataRoute("/settings")).toBeNull();
    expect(matchDocumentMetadataRoute("/review/not-a-uuid")).toBeNull();
    expect(matchDocumentMetadataRoute("/album/a/tracks")).toBeNull();
  });
});

describe("document metadata resolution", () => {
  it("uses a local album row without spending Spotify rate limit", async () => {
    mocks.getDb.mockResolvedValue(
      createDbWithRows([{ artistNames: ["Artist"], coverUrl: "cover.jpg", title: "Album" }])
    );

    const metadata = await resolveDocumentMetadata(
      { albumId: "album-a", kind: "album" },
      new Request("https://ratiomusic.live/album/album-a")
    );

    expect(metadata).toMatchObject({
      image: "cover.jpg",
      title: "Album by Artist — Reviews | Ratio",
      type: "music.album",
    });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.getAlbumPersistenceMetadata).not.toHaveBeenCalled();
  });

  it("rate limits and uses cached Spotify catalog metadata when an album is not local", async () => {
    mocks.getDb.mockResolvedValue(createDbWithRows([]));
    mocks.getAlbumPersistenceMetadata.mockResolvedValue({
      artistNames: ["Artist"],
      coverUrl: "spotify-cover.jpg",
      id: "album-a",
      releaseDate: "2026-01-01",
      title: "Album",
      totalTracks: 10,
    });
    const request = new Request("https://ratiomusic.live/album/album-a");

    const metadata = await resolveDocumentMetadata({ albumId: "album-a", kind: "album" }, request);

    expect(metadata).toMatchObject({ image: "spotify-cover.jpg", title: "Album by Artist — Reviews | Ratio" });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(request, {
      bindingName: "SPOTIFY_CATALOG_RATE_LIMITER",
    });
    expect(mocks.getAlbumPersistenceMetadata).toHaveBeenCalledWith("album-a");
  });

  it("does not treat a database failure as a missing local album", async () => {
    mocks.getDb.mockRejectedValue(new Error("Database unavailable"));

    await expect(
      resolveDocumentMetadata(
        { albumId: "album-a", kind: "album" },
        new Request("https://ratiomusic.live/album/album-a")
      )
    ).rejects.toThrow("Database unavailable");

    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.getAlbumPersistenceMetadata).not.toHaveBeenCalled();
  });

  it("creates profile metadata from a narrow public row", async () => {
    mocks.getDb.mockResolvedValue(
      createDbWithRows([{ avatarUrl: "avatar.jpg", displayUsername: null, name: "Account Name", username: "listener" }])
    );

    const metadata = await resolveDocumentMetadata(
      { kind: "profile", username: "listener" },
      new Request("https://ratiomusic.live/user/listener")
    );

    expect(metadata).toMatchObject({
      additionalMeta: [{ content: "listener", property: "profile:username" }],
      image: "avatar.jpg",
      title: "Account Name (@listener) — Album Reviews | Ratio",
      type: "profile",
    });
  });

  it("creates review metadata without reading the review body", async () => {
    mocks.getDb.mockResolvedValue(
      createDbWithRows([
        {
          artistNames: ["Artist"],
          authorDisplayUsername: null,
          authorId: "user-a",
          authorUsername: null,
          coverUrl: "cover.jpg",
          rating: 9,
          title: "Album",
        },
      ])
    );

    const metadata = await resolveDocumentMetadata(
      { kind: "review", reviewId: "8ad8b676-8e99-4d4a-8e99-95a56fe78c5a" },
      new Request("https://ratiomusic.live/review/8ad8b676-8e99-4d4a-8e99-95a56fe78c5a")
    );

    expect(metadata).toMatchObject({
      description: "user-a rated Album by Artist 4.5/5 on Ratio.",
      image: "cover.jpg",
      title: "Album review by user-a | Ratio",
      type: "article",
    });
  });
});

function createDbWithRows(rows: unknown[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
    where: vi.fn(),
  };

  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);

  return {
    select: vi.fn().mockReturnValue(query),
  };
}
