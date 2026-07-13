import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import {
  createAuthenticatedContext,
  createTestAlbum,
  createTestReview,
  createTestReviewLike,
  createTestUser,
  createTestUserFollow,
} from "@test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getFeedService, getFollowingFeedService } from "@/server/services/feed-service";

const mockState = vi.hoisted(() => ({
  currentUserId: undefined as string | undefined,
  db: undefined as unknown,
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(async () => mockState.db),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  createAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn(async () =>
        mockState.currentUserId
          ? {
              user: {
                id: mockState.currentUserId,
              },
            }
          : null
      ),
    },
  })),
}));

beforeAll(async () => {
  mockState.db = testDb;
  await migrateTestDatabase();
});

beforeEach(async () => {
  mockState.currentUserId = undefined;
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("getFeedService anonymous feed", () => {
  it("returns recent visible reviews", async () => {
    const author = await createTestUser(testDb);
    const review = await createTestReview(testDb, {
      body: "Visible recent review",
      createdAt: daysAgo(1),
      rating: 9,
      userId: author.id,
    });

    const page = await getFeedService({});

    expect(page.reviews).toEqual([expect.objectContaining({ id: review.id })]);
  });

  it("excludes reviews by banned users", async () => {
    const visibleAuthor = await createTestUser(testDb);
    const bannedAuthor = await createTestUser(testDb, { banned: true });
    const visibleReview = await createTestReview(testDb, { createdAt: daysAgo(1), userId: visibleAuthor.id });

    await createTestReview(testDb, { createdAt: daysAgo(1), userId: bannedAuthor.id });

    const page = await getFeedService({});

    expect(page.reviews.map((review) => review.id)).toEqual([visibleReview.id]);
  });

  it("includes recent-like candidates", async () => {
    const author = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, {
      body: "Old review resurfaced by a like",
      createdAt: daysAgo(45),
      userId: author.id,
    });

    await createTestReviewLike(testDb, { createdAt: daysAgo(1), reviewId: review.id, userId: liker.id });

    const page = await getFeedService({});

    expect(page.reviews).toEqual([expect.objectContaining({ id: review.id, likes: 1 })]);
  });

  it("deduplicates reviews appearing from multiple sources", async () => {
    const author = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, {
      body: "Recent review with a recent like",
      createdAt: daysAgo(1),
      userId: author.id,
    });

    await createTestReviewLike(testDb, { createdAt: hoursAgo(1), reviewId: review.id, userId: liker.id });

    const page = await getFeedService({});

    expect(page.reviews.filter((feedReview) => feedReview.id === review.id)).toHaveLength(1);
  });

  it("maps album, user, and review fields correctly", async () => {
    const album = await createTestAlbum(testDb, {
      artistNames: ["Artist One", "Artist Two"],
      coverUrl: "https://example.com/cover.jpg",
      releaseDate: "1999-01-01",
      title: "Mapped Album",
    });
    const author = await createTestUser(testDb, {
      displayUsername: "Mapped User",
      image: "https://example.com/avatar.jpg",
      username: "mapped_user",
    });
    const review = await createTestReview(testDb, {
      albumId: album.id,
      body: "Mapped review body",
      createdAt: daysAgo(1),
      rating: 7,
      userId: author.id,
    });

    const page = await getFeedService({});

    expect(page.reviews[0]).toMatchObject({
      album: {
        artist: "Artist One, Artist Two",
        coverUrl: "https://example.com/cover.jpg",
        id: album.id,
        title: "Mapped Album",
        year: "1999",
      },
      canDelete: false,
      id: review.id,
      liked: false,
      rating: 3.5,
      review: "Mapped review body",
      shareCode: review.shareCode,
      user: {
        avatarUrl: "https://example.com/avatar.jpg",
        displayUsername: "Mapped User",
        username: "mapped_user",
      },
    });
  });
});

describe("getFeedService authenticated feed", () => {
  it("includes followed-user reviews", async () => {
    const viewer = await createTestUser(testDb);
    const followedAuthor = await createTestUser(testDb);
    mockState.currentUserId = viewer.id;

    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: followedAuthor.id });
    const review = await createTestReview(testDb, { createdAt: daysAgo(1), userId: followedAuthor.id });

    const page = await getFeedService({});

    expect(page.reviews.map((feedReview) => feedReview.id)).toContain(review.id);
  });

  it("prioritizes followed-user reviews over comparable global candidates", async () => {
    const viewer = await createTestUser(testDb);
    const followedAuthor = await createTestUser(testDb);
    const globalAuthor = await createTestUser(testDb);
    mockState.currentUserId = viewer.id;

    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: followedAuthor.id });
    const followedReview = await createTestReview(testDb, {
      body: "Followed review",
      createdAt: daysAgo(1),
      userId: followedAuthor.id,
    });
    const globalReview = await createTestReview(testDb, {
      body: "Global review",
      createdAt: daysAgo(1),
      userId: globalAuthor.id,
    });

    const page = await getFeedService({});

    expect(indexOfReview(page.reviews, followedReview.id)).toBeLessThan(indexOfReview(page.reviews, globalReview.id));
  });

  it("marks canDelete for viewer-owned reviews", async () => {
    const viewer = await createTestUser(testDb);
    mockState.currentUserId = viewer.id;
    const review = await createTestReview(testDb, { createdAt: daysAgo(1), userId: viewer.id });

    const page = await getFeedService({});

    expect(page.reviews.find((feedReview) => feedReview.id === review.id)).toMatchObject({ canDelete: true });
  });

  it("marks liked for reviews liked by the viewer", async () => {
    const viewer = await createTestUser(testDb);
    const author = await createTestUser(testDb);
    mockState.currentUserId = viewer.id;
    const review = await createTestReview(testDb, { createdAt: daysAgo(1), userId: author.id });

    await createTestReviewLike(testDb, { reviewId: review.id, userId: viewer.id });

    const page = await getFeedService({});

    expect(page.reviews.find((feedReview) => feedReview.id === review.id)).toMatchObject({ liked: true });
  });

  it("does not over-prioritize viewer-owned reviews", async () => {
    const viewer = await createTestUser(testDb);
    const followedAuthor = await createTestUser(testDb);
    mockState.currentUserId = viewer.id;

    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: followedAuthor.id });
    const ownReview = await createTestReview(testDb, {
      body: "Own review",
      createdAt: daysAgo(1),
      userId: viewer.id,
    });
    const followedReview = await createTestReview(testDb, {
      body: "Followed review",
      createdAt: daysAgo(1),
      userId: followedAuthor.id,
    });

    const page = await getFeedService({});

    expect(indexOfReview(page.reviews, followedReview.id)).toBeLessThan(indexOfReview(page.reviews, ownReview.id));
  });
});

describe("getFollowingFeedService", () => {
  it("returns only followed-user reviews in reverse chronological order", async () => {
    const viewer = await createTestUser(testDb);
    const followedAuthor = await createTestUser(testDb);
    const globalAuthor = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, viewer);

    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: followedAuthor.id });
    const olderFollowedReview = await createTestReview(testDb, {
      createdAt: daysAgo(45),
      userId: followedAuthor.id,
    });
    const newerFollowedReview = await createTestReview(testDb, {
      createdAt: daysAgo(1),
      userId: followedAuthor.id,
    });
    const globalReview = await createTestReview(testDb, {
      createdAt: hoursAgo(1),
      userId: globalAuthor.id,
    });

    const page = await getFollowingFeedService({}, context);

    expect(page.reviews.map((review) => review.id)).toEqual([newerFollowedReview.id, olderFollowedReview.id]);
    expect(page.reviews.map((review) => review.id)).not.toContain(globalReview.id);
  });

  it("maps viewer like state and excludes banned followed users", async () => {
    const viewer = await createTestUser(testDb);
    const followedAuthor = await createTestUser(testDb);
    const bannedFollowedAuthor = await createTestUser(testDb, { banned: true });
    const context = createAuthenticatedContext(testDb, viewer);

    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: followedAuthor.id });
    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: bannedFollowedAuthor.id });
    const visibleReview = await createTestReview(testDb, { userId: followedAuthor.id });
    const bannedReview = await createTestReview(testDb, { userId: bannedFollowedAuthor.id });
    await createTestReviewLike(testDb, { reviewId: visibleReview.id, userId: viewer.id });

    const page = await getFollowingFeedService({}, context);

    expect(page.reviews).toEqual([
      expect.objectContaining({ canDelete: false, id: visibleReview.id, liked: true, likes: 1 }),
    ]);
    expect(page.reviews.map((review) => review.id)).not.toContain(bannedReview.id);
  });

  it("paginates without repeating reviews", async () => {
    const viewer = await createTestUser(testDb);
    const followedAuthor = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, viewer);

    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: followedAuthor.id });
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        createTestReview(testDb, {
          body: `Following review ${index}`,
          createdAt: minutesAgo(index),
          userId: followedAuthor.id,
        })
      )
    );

    const firstPage = await getFollowingFeedService({}, context);
    const secondPage = await getFollowingFeedService({ cursor: firstPage.nextCursor ?? undefined }, context);
    const firstPageIds = new Set(firstPage.reviews.map((review) => review.id));

    expect(firstPage.reviews).toHaveLength(20);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(secondPage.reviews).toHaveLength(1);
    expect(secondPage.reviews.some((review) => firstPageIds.has(review.id))).toBe(false);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("rejects malformed cursors", async () => {
    const viewer = await createTestUser(testDb);

    await expect(
      getFollowingFeedService({ cursor: "not a cursor" }, createAuthenticatedContext(testDb, viewer))
    ).rejects.toThrow("Invalid following feed cursor");
  });
});

describe("getFeedService diversity and ranking", () => {
  it("caps repeated albums per page", async () => {
    const album = await createTestAlbum(testDb);
    const reviews = await Promise.all(
      [0, 1, 2].map(async (index) => {
        const author = await createTestUser(testDb);
        return await createTestReview(testDb, {
          albumId: album.id,
          body: `Album repeat ${index}`,
          createdAt: minutesAgo(index),
          userId: author.id,
        });
      })
    );

    const page = await getFeedService({});

    expect(page.reviews.filter((review) => review.album.id === album.id)).toHaveLength(2);
    expect(page.reviews.map((review) => review.id)).not.toContain(reviews.at(-1)?.id);
  });

  it("caps repeated authors per page", async () => {
    const author = await createTestUser(testDb);
    const reviews = await Promise.all(
      [0, 1, 2].map(
        async (index) =>
          await createTestReview(testDb, {
            body: `Author repeat ${index}`,
            createdAt: minutesAgo(index),
            userId: author.id,
          })
      )
    );

    const page = await getFeedService({});

    expect(page.reviews.filter((review) => review.user.username === author.username)).toHaveLength(2);
    expect(page.reviews.map((review) => review.id)).not.toContain(reviews.at(-1)?.id);
  });

  it("caps rating-only reviews", async () => {
    await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const author = await createTestUser(testDb);
        return await createTestReview(testDb, {
          body: null,
          createdAt: minutesAgo(index),
          userId: author.id,
        });
      })
    );

    const page = await getFeedService({});

    expect(page.reviews.filter((review) => !review.review)).toHaveLength(3);
  });

  it("written reviews outrank rating-only reviews when otherwise similar", async () => {
    const writtenAuthor = await createTestUser(testDb);
    const ratingOnlyAuthor = await createTestUser(testDb);
    const writtenReview = await createTestReview(testDb, {
      body: "Written review",
      createdAt: daysAgo(1),
      userId: writtenAuthor.id,
    });
    const ratingOnlyReview = await createTestReview(testDb, {
      body: null,
      createdAt: daysAgo(1),
      userId: ratingOnlyAuthor.id,
    });

    const page = await getFeedService({});

    expect(indexOfReview(page.reviews, writtenReview.id)).toBeLessThan(
      indexOfReview(page.reviews, ratingOnlyReview.id)
    );
  });

  it("recent likes can resurface older reviews within the configured windows", async () => {
    const oldAuthor = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const recentAuthor = await createTestUser(testDb);
    const oldReview = await createTestReview(testDb, {
      body: "Old resurfaced review",
      createdAt: daysAgo(45),
      userId: oldAuthor.id,
    });
    const recentReview = await createTestReview(testDb, {
      body: "Recent normal review",
      createdAt: daysAgo(2),
      userId: recentAuthor.id,
    });

    await createTestReviewLike(testDb, { createdAt: hoursAgo(1), reviewId: oldReview.id, userId: liker.id });

    const page = await getFeedService({});
    const ids = page.reviews.map((review) => review.id);

    expect(ids).toContain(oldReview.id);
    expect(ids).toContain(recentReview.id);
  });
});

describe("getFeedService cursor behavior", () => {
  it("returns next cursor when there are more selected candidates", async () => {
    await createManyFeedReviews(21);

    const page = await getFeedService({});

    expect(page.reviews).toHaveLength(20);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it("second page does not repeat first-page review IDs", async () => {
    await createManyFeedReviews(21);

    const firstPage = await getFeedService({});
    const secondPage = await getFeedService({ cursor: firstPage.nextCursor ?? undefined });
    const firstPageIds = new Set(firstPage.reviews.map((review) => review.id));

    expect(secondPage.reviews).toHaveLength(1);
    expect(secondPage.reviews.some((review) => firstPageIds.has(review.id))).toBe(false);
  });

  it("malformed cursor throws the expected feed cursor error", async () => {
    await expect(getFeedService({ cursor: "not a cursor" })).rejects.toThrow("Invalid feed cursor");
  });

  it("cursor seen IDs remain bounded", async () => {
    await createManyFeedReviews(21);

    const page = await getFeedService({});
    const payload = JSON.parse(atob(page.nextCursor ?? ""));

    expect(payload.seenReviewIds).toHaveLength(20);
    expect(payload.seenReviewIds.length).toBeLessThanOrEqual(100);
  });
});

describe("getFeedService edge cases", () => {
  it("empty database returns empty feed and null cursor", async () => {
    await expect(getFeedService({})).resolves.toEqual({
      nextCursor: null,
      reviews: [],
    });
  });

  it("banned likers do not contribute like stats", async () => {
    const author = await createTestUser(testDb);
    const bannedLiker = await createTestUser(testDb, { banned: true });
    const review = await createTestReview(testDb, { createdAt: daysAgo(1), userId: author.id });

    await createTestReviewLike(testDb, { createdAt: hoursAgo(1), reviewId: review.id, userId: bannedLiker.id });

    const page = await getFeedService({});

    expect(page.reviews.find((feedReview) => feedReview.id === review.id)).toMatchObject({ likes: 0 });
  });

  it("old reviews outside lookback are excluded unless resurfaced by recent likes", async () => {
    const oldAuthor = await createTestUser(testDb);
    const resurfacedAuthor = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const oldReview = await createTestReview(testDb, {
      body: "Old hidden review",
      createdAt: daysAgo(45),
      userId: oldAuthor.id,
    });
    const resurfacedReview = await createTestReview(testDb, {
      body: "Old resurfaced review",
      createdAt: daysAgo(45),
      userId: resurfacedAuthor.id,
    });

    await createTestReviewLike(testDb, { createdAt: daysAgo(1), reviewId: resurfacedReview.id, userId: liker.id });

    const page = await getFeedService({});
    const ids = page.reviews.map((review) => review.id);

    expect(ids).not.toContain(oldReview.id);
    expect(ids).toContain(resurfacedReview.id);
  });
});

async function createManyFeedReviews(count: number) {
  return await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const author = await createTestUser(testDb);
      return await createTestReview(testDb, {
        body: `Feed review ${index}`,
        createdAt: minutesAgo(index),
        userId: author.id,
      });
    })
  );
}

function indexOfReview(feedReviews: { id: string }[], reviewId: string) {
  return feedReviews.findIndex((review) => review.id === reviewId);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}
