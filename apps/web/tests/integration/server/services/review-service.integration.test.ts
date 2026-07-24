import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import {
  createAuthenticatedContext,
  createTestAlbum,
  createTestReview,
  createTestReviewLike,
  createTestUser,
} from "@test/fixtures";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { notifications, reviewLikes, reviews } from "@/lib/db/schema";
import { createReviewService, deleteReviewService, setReviewLikeService } from "@/server/services/review-service";

vi.mock("@/server/services/spotify-service", () => ({
  getAlbumPersistenceMetadata: vi.fn(() => {
    throw new Error("Spotify should not be called by these integration tests");
  }),
}));

beforeAll(async () => {
  await migrateTestDatabase();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("createReviewService", () => {
  it("creates a review for an existing album", async () => {
    const testUser = await createTestUser(testDb);
    const album = await createTestAlbum(testDb);
    const context = createAuthenticatedContext(testDb, testUser);

    const review = await createReviewService({ albumId: album.id, body: "Great record", rating: 9 }, context);

    expect(review).toMatchObject({
      albumId: album.id,
      body: "Great record",
      rating: 9,
      userId: testUser.id,
    });
  });

  it("stores the provided rating and normalizes an empty body to null", async () => {
    const testUser = await createTestUser(testDb);
    const album = await createTestAlbum(testDb);
    const context = createAuthenticatedContext(testDb, testUser);

    const review = await createReviewService({ albumId: album.id, body: "", rating: 7 }, context);

    const [storedReview] = await testDb.select().from(reviews).where(eq(reviews.id, review.id)).limit(1);

    expect(storedReview).toMatchObject({
      body: null,
      rating: 7,
    });
  });

  it("rejects a duplicate user and album review", async () => {
    const testUser = await createTestUser(testDb);
    const album = await createTestAlbum(testDb);
    const context = createAuthenticatedContext(testDb, testUser);

    await createReviewService({ albumId: album.id, body: "First", rating: 8 }, context);

    await expect(createReviewService({ albumId: album.id, body: "Second", rating: 6 }, context)).rejects.toThrow();
  });
});

describe("deleteReviewService", () => {
  it("allows owner deletion and removes the review from the DB", async () => {
    const testUser = await createTestUser(testDb);
    const album = await createTestAlbum(testDb);
    const review = await createTestReview(testDb, { albumId: album.id, userId: testUser.id });
    const context = createAuthenticatedContext(testDb, testUser);

    await expect(deleteReviewService({ reviewId: review.id }, context)).resolves.toEqual({
      albumId: album.id,
      id: review.id,
    });

    const storedReviews = await testDb.select().from(reviews).where(eq(reviews.id, review.id));

    expect(storedReviews).toEqual([]);
  });

  it("rejects non-owner deletion and keeps the review", async () => {
    const owner = await createTestUser(testDb);
    const otherUser = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: owner.id });
    const context = createAuthenticatedContext(testDb, otherUser);

    await expect(deleteReviewService({ reviewId: review.id }, context)).rejects.toThrow("Review not found");

    const storedReviews = await testDb.select().from(reviews).where(eq(reviews.id, review.id));

    expect(storedReviews).toHaveLength(1);
  });

  it("allows admin deletion of another user's review", async () => {
    const owner = await createTestUser(testDb);
    const admin = await createTestUser(testDb, { role: "admin" });
    const review = await createTestReview(testDb, { userId: owner.id });
    const context = createAuthenticatedContext(testDb, admin, { isAdmin: true });

    await expect(deleteReviewService({ reviewId: review.id }, context)).resolves.toMatchObject({
      id: review.id,
    });

    const storedReviews = await testDb.select().from(reviews).where(eq(reviews.id, review.id));

    expect(storedReviews).toEqual([]);
  });
});

describe("setReviewLikeService", () => {
  it("liking a review inserts a like row", async () => {
    const author = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, liker);

    await expect(setReviewLikeService({ liked: true, reviewId: review.id }, context)).resolves.toEqual({
      liked: true,
      likes: 1,
      reviewId: review.id,
    });

    const storedLikes = await testDb.select().from(reviewLikes).where(eq(reviewLikes.reviewId, review.id));

    expect(storedLikes).toMatchObject([{ reviewId: review.id, userId: liker.id }]);
  });

  it("liking the same review twice is idempotent", async () => {
    const author = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, liker);

    await setReviewLikeService({ liked: true, reviewId: review.id }, context);
    const result = await setReviewLikeService({ liked: true, reviewId: review.id }, context);

    const storedLikes = await testDb.select().from(reviewLikes).where(eq(reviewLikes.reviewId, review.id));

    expect(result.likes).toBe(1);
    expect(storedLikes).toHaveLength(1);
  });

  it("unliking removes the like row", async () => {
    const author = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, liker);

    await createTestReviewLike(testDb, { reviewId: review.id, userId: liker.id });

    await expect(setReviewLikeService({ liked: false, reviewId: review.id }, context)).resolves.toEqual({
      liked: false,
      likes: 0,
      reviewId: review.id,
    });

    const storedLikes = await testDb.select().from(reviewLikes).where(eq(reviewLikes.reviewId, review.id));

    expect(storedLikes).toEqual([]);
  });

  it("returned like count excludes likes from banned users", async () => {
    const author = await createTestUser(testDb);
    const bannedLiker = await createTestUser(testDb, { banned: true });
    const visibleLiker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, visibleLiker);

    await createTestReviewLike(testDb, { reviewId: review.id, userId: bannedLiker.id });

    const result = await setReviewLikeService({ liked: true, reviewId: review.id }, context);
    const storedLikes = await testDb.select().from(reviewLikes).where(eq(reviewLikes.reviewId, review.id));

    expect(result.likes).toBe(1);
    expect(storedLikes).toHaveLength(2);
  });

  it("non-admin users cannot like reviews by banned authors", async () => {
    const bannedAuthor = await createTestUser(testDb, { banned: true });
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: bannedAuthor.id });
    const context = createAuthenticatedContext(testDb, liker);

    await expect(setReviewLikeService({ liked: true, reviewId: review.id }, context)).rejects.toThrow(
      "Review not found"
    );

    const storedLikes = await testDb.select().from(reviewLikes).where(eq(reviewLikes.reviewId, review.id));

    expect(storedLikes).toEqual([]);
  });

  it("admins can like reviews by banned authors", async () => {
    const bannedAuthor = await createTestUser(testDb, { banned: true });
    const admin = await createTestUser(testDb, { role: "admin" });
    const review = await createTestReview(testDb, { userId: bannedAuthor.id });
    const context = createAuthenticatedContext(testDb, admin, { isAdmin: true });

    await expect(setReviewLikeService({ liked: true, reviewId: review.id }, context)).resolves.toMatchObject({
      liked: true,
      reviewId: review.id,
    });

    const storedLikes = await testDb.select().from(reviewLikes).where(eq(reviewLikes.reviewId, review.id));

    expect(storedLikes).toMatchObject([{ reviewId: review.id, userId: admin.id }]);
  });

  it("liking your own review does not create a notification", async () => {
    const author = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, author);

    await setReviewLikeService({ liked: true, reviewId: review.id }, context);

    const storedNotifications = await testDb.select().from(notifications);

    expect(storedNotifications).toEqual([]);
  });

  it("liking another user's review creates a review_liked notification", async () => {
    const author = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, liker);

    await setReviewLikeService({ liked: true, reviewId: review.id }, context);

    const storedNotifications = await testDb.select().from(notifications);

    expect(storedNotifications).toMatchObject([
      {
        actorUserId: liker.id,
        recipientUserId: author.id,
        reviewId: review.id,
        seenAt: null,
        type: "review_liked",
      },
    ]);
  });

  it("duplicate liking does not create duplicate notifications", async () => {
    const author = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, liker);

    await setReviewLikeService({ liked: true, reviewId: review.id }, context);
    await setReviewLikeService({ liked: true, reviewId: review.id }, context);

    const storedNotifications = await testDb
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.actorUserId, liker.id),
          eq(notifications.recipientUserId, author.id),
          eq(notifications.reviewId, review.id)
        )
      );

    expect(storedNotifications).toHaveLength(1);
  });
});
