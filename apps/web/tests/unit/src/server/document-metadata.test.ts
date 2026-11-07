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
    expect(matchDocumentMetadataRoute("/album/5vkqYmiPBYLaalcmjujWxK")).toEqual({
      albumId: "5vkqYmiPBYLaalcmjujWxK",
      kind: "album",
    });
    expect(matchDocumentMetadataRoute("/list/43e2f9c6-2355-4216-8f27-c607cb54d956")).toEqual({
      kind: "list",
      listId: "43e2f9c6-2355-4216-8f27-c607cb54d956",
    });
    expect(matchDocumentMetadataRoute("/list/not-a-uuid")).toBeNull();
    expect(matchDocumentMetadataRoute("/album/album-a")).toBeNull();
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
      createDbWithRows([
        {
          artistNames: ["Artist"],
          coverUrl: "cover.jpg",
          ratingAverage: 3.6666,
          ratingCount: 3,
          releaseDate: "2026-01-01",
          title: "Album",
          totalTracks: 10,
        },
      ])
    );

    const metadata = await resolveDocumentMetadata(
      { albumId: "album-a", kind: "album" },
      new Request("https://ratiomusic.live/album/album-a")
    );

    expect(metadata).toMatchObject({
      image: "cover.jpg",
      jsonLd: {
        "@type": "MusicAlbum",
        aggregateRating: { bestRating: 5, ratingCount: 3, ratingValue: 3.7, worstRating: 0.5 },
        byArtist: [{ "@type": "MusicGroup", name: "Artist" }],
        datePublished: "2026-01-01",
        name: "Album",
        url: "https://ratiomusic.live/album/album-a",
      },
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
    expect(metadata).not.toHaveProperty("jsonLd.aggregateRating");
    expect(metadata).toHaveProperty("jsonLd.name", "Album");
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

  it("creates list metadata with the top album's cover and an ordered item list", async () => {
    const listRow = {
      authorDisplayUsername: "Miguel",
      authorName: "Account Name",
      description: "Five records that make the decade.",
      isRanked: true,
      title: "Start here: the 70s",
    };
    mocks.getDb.mockResolvedValue(
      createDbWithRows([
        {
          ...listRow,
          album: { artistNames: ["Marvin Gaye"], coverUrl: "top.jpg", id: "album-1", title: "What's Going On" },
        },
        {
          ...listRow,
          album: { artistNames: ["Fleetwood Mac"], coverUrl: "second.jpg", id: "album-2", title: "Rumours" },
        },
      ])
    );

    const metadata = await resolveDocumentMetadata(
      { kind: "list", listId: "43e2f9c6-2355-4216-8f27-c607cb54d956" },
      new Request("https://ratiomusic.live/list/43e2f9c6-2355-4216-8f27-c607cb54d956")
    );

    expect(metadata).toMatchObject({
      description: "Five records that make the decade. 2 albums by Miguel on Ratio.",
      image: "top.jpg",
      imageAlt: "What's Going On album cover",
      jsonLd: {
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        name: "Start here: the 70s",
        numberOfItems: 2,
      },
      title: "Start here: the 70s — Album list by Miguel | Ratio",
      type: "article",
    });
    expect(metadata).toHaveProperty("jsonLd.itemListElement.1", {
      "@type": "ListItem",
      item: {
        "@type": "MusicAlbum",
        byArtist: [{ "@type": "MusicGroup", name: "Fleetwood Mac" }],
        name: "Rumours",
        url: "https://ratiomusic.live/album/album-2",
      },
      position: 2,
    });
  });

  it("describes an empty list without an image", async () => {
    mocks.getDb.mockResolvedValue(
      createDbWithRows([
        {
          album: null,
          authorDisplayUsername: null,
          authorName: "Account Name",
          description: null,
          isRanked: false,
          title: "Empty",
        },
      ])
    );

    const metadata = await resolveDocumentMetadata(
      { kind: "list", listId: "43e2f9c6-2355-4216-8f27-c607cb54d956" },
      new Request("https://ratiomusic.live/list/43e2f9c6-2355-4216-8f27-c607cb54d956")
    );

    expect(metadata).toMatchObject({
      description: "A list of 0 albums by Account Name on Ratio.",
      image: null,
      jsonLd: { itemListElement: [], itemListOrder: "https://schema.org/ItemListUnordered", numberOfItems: 0 },
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
    groupBy: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn(),
    where: vi.fn(),
  };

  query.from.mockReturnValue(query);
  query.groupBy.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.leftJoin.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.where.mockReturnValue(query);

  return {
    select: vi.fn().mockReturnValue(query),
  };
}
