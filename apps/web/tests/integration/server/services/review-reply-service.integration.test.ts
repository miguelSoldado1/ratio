import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import {
  createAuthenticatedContext,
  createTestAlbum,
  createTestReview,
  createTestReviewLike,
  createTestReviewReply,
  createTestReviewReplyLike,
  createTestUser,
} from "@test/fixtures";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { notifications, reviewReplies, reviewReplyLikes, reviews, user } from "@/lib/db/schema";
import { getNotificationsService } from "@/server/services/notification-service";
import {
  createReviewReplyService,
  deleteReviewReplyService,
  getReviewRepliesService,
  getReviewReplyLikesService,
  setReviewReplyLikeService,
} from "@/server/services/review-reply-service";
import {
  getAlbumReviewsService,
  getUserLikedReviewsService,
  getUserReviewsService,
} from "@/server/services/review-service";

const mockState = vi.hoisted(() => ({
  currentUser: undefined as { id: string; isAdmin: boolean } | undefined,
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
        mockState.currentUser
          ? {
              user: {
                id: mockState.currentUser.id,
                role: mockState.currentUser.isAdmin ? "admin" : null,
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
  mockState.currentUser = undefined;
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("review reply schema", () => {
  it("accepts 500 characters and rejects longer or whitespace-only bodies", async () => {
    const replyAuthor = await createTestUser(testDb);
    const review = await createTestReview(testDb);

    await expect(
      createTestReviewReply(testDb, { body: "a".repeat(500), reviewId: review.id, userId: replyAuthor.id })
    ).resolves.toMatchObject({ body: "a".repeat(500) });
    await expect(
      createTestReviewReply(testDb, { body: "a".repeat(501), reviewId: review.id, userId: replyAuthor.id })
    ).rejects.toThrow();
    await expect(
      createTestReviewReply(testDb, { body: " \n\t", reviewId: review.id, userId: replyAuthor.id })
    ).rejects.toThrow();
  });
});

describe("getReviewRepliesService", () => {
  it("returns 12 oldest replies, a stable keyset cursor, and the initial visible total", async () => {
    const review = await createTestReview(testDb);
    const author = await createTestUser(testDb);
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const replyIds = Array.from(
      { length: 13 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    );

    for (const id of replyIds) {
      await createTestReviewReply(testDb, { createdAt, id, reviewId: review.id, userId: author.id });
    }

    const firstPage = await getReviewRepliesService({ reviewId: review.id });
    const secondPage = await getReviewRepliesService({
      cursor: firstPage.nextCursor ?? undefined,
      reviewId: review.id,
    });

    expect(firstPage.replies.map((reply) => reply.id)).toEqual(replyIds.slice(0, 12));
    expect(firstPage.totalCount).toBe(13);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(secondPage.replies.map((reply) => reply.id)).toEqual(replyIds.slice(12));
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.totalCount).toBeNull();
  });

  it("does not repeat the boundary reply across pages for service-created replies", async () => {
    const review = await createTestReview(testDb);
    const replyAuthor = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, replyAuthor);

    for (let index = 0; index < 13; index++) {
      await createReviewReplyService({ body: `Reply ${index}`, reviewId: review.id }, context);
    }

    const firstPage = await getReviewRepliesService({ reviewId: review.id });
    const secondPage = await getReviewRepliesService({
      cursor: firstPage.nextCursor ?? undefined,
      reviewId: review.id,
    });
    const allReplyIds = [...firstPage.replies, ...secondPage.replies].map((reply) => reply.id);

    expect(allReplyIds).toHaveLength(13);
    expect(new Set(allReplyIds).size).toBe(13);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("hides replies by banned authors and every reply on a banned root review", async () => {
    const rootAuthor = await createTestUser(testDb);
    const visibleReplyAuthor = await createTestUser(testDb);
    const bannedReplyAuthor = await createTestUser(testDb, { banned: true });
    const review = await createTestReview(testDb, { userId: rootAuthor.id });
    const visibleReply = await createTestReviewReply(testDb, {
      reviewId: review.id,
      userId: visibleReplyAuthor.id,
    });
    await createTestReviewReply(testDb, { reviewId: review.id, userId: bannedReplyAuthor.id });

    await expect(getReviewRepliesService({ reviewId: review.id })).resolves.toMatchObject({
      replies: [expect.objectContaining({ id: visibleReply.id })],
      totalCount: 1,
    });

    await testDb.update(user).set({ banned: true }).where(eq(user.id, rootAuthor.id));

    await expect(getReviewRepliesService({ reviewId: review.id })).resolves.toEqual({
      nextCursor: null,
      replies: [],
      totalCount: 0,
    });
  });

  it("hydrates viewer-specific like and delete state while excluding banned likers from the count", async () => {
    const rootAuthor = await createTestUser(testDb);
    const replyAuthor = await createTestUser(testDb);
    const bannedLiker = await createTestUser(testDb, { banned: true });
    const review = await createTestReview(testDb, { userId: rootAuthor.id });
    const reply = await createTestReviewReply(testDb, { reviewId: review.id, userId: replyAuthor.id });
    await createTestReviewReplyLike(testDb, { replyId: reply.id, userId: replyAuthor.id });
    await createTestReviewReplyLike(testDb, { replyId: reply.id, userId: bannedLiker.id });
    mockState.currentUser = { id: replyAuthor.id, isAdmin: false };

    const page = await getReviewRepliesService({ reviewId: review.id });

    expect(page.replies).toMatchObject([{ canDelete: true, liked: true, likes: 1 }]);
  });
});

describe("getReviewReplyLikesService", () => {
  it("returns visible likers with the signed-in viewer pinned on the first page", async () => {
    const reply = await createTestReviewReply(testDb);
    const viewer = await createTestUser(testDb);
    const likers = await Promise.all(Array.from({ length: 25 }, () => createTestUser(testDb)));
    const bannedLiker = await createTestUser(testDb, { banned: true });

    await createTestReviewReplyLike(testDb, { replyId: reply.id, userId: viewer.id });
    for (const [index, liker] of likers.entries()) {
      await createTestReviewReplyLike(testDb, {
        createdAt: new Date(`2026-01-01T00:${String(index).padStart(2, "0")}:00.000Z`),
        replyId: reply.id,
        userId: liker.id,
      });
    }
    await createTestReviewReplyLike(testDb, { replyId: reply.id, userId: bannedLiker.id });
    mockState.currentUser = { id: viewer.id, isAdmin: false };

    const firstPage = await getReviewReplyLikesService({ replyId: reply.id });
    const secondPage = await getReviewReplyLikesService({
      cursor: firstPage.nextCursor ?? undefined,
      replyId: reply.id,
    });
    const returnedUserIds = [...firstPage.users, ...secondPage.users].map((listedUser) => listedUser.id);

    expect(firstPage.users[0]?.id).toBe(viewer.id);
    expect(firstPage.users).toHaveLength(25);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(secondPage.users).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(new Set(returnedUserIds).size).toBe(26);
    expect(returnedUserIds).not.toContain(bannedLiker.id);
  });

  it("rejects a missing reply instead of returning an empty liker list", async () => {
    await expect(getReviewReplyLikesService({ replyId: "00000000-0000-4000-8000-000000000099" })).rejects.toThrow(
      "Reply not found"
    );
  });
});

describe("createReviewReplyService", () => {
  it("creates replies on rating-only reviews and notifies the review author", async () => {
    const reviewAuthor = await createTestUser(testDb);
    const actor = await createTestUser(testDb, { displayUsername: "Carly" });
    const review = await createTestReview(testDb, { body: null, userId: reviewAuthor.id });

    const reply = await createReviewReplyService(
      { body: "A rating-only thread", reviewId: review.id },
      createAuthenticatedContext(testDb, actor)
    );
    const storedNotifications = await testDb.select().from(notifications);

    expect(reply).toMatchObject({
      body: "A rating-only thread",
      canDelete: true,
      liked: false,
      likes: 0,
      user: { id: actor.id },
    });
    expect(storedNotifications).toMatchObject([
      {
        actorUserId: actor.id,
        recipientUserId: reviewAuthor.id,
        replyId: reply.id,
        reviewId: review.id,
        type: "review_replied",
      },
    ]);
  });

  it("deduplicates author/participant recipients, updates the latest actor and reply, and resets seen state", async () => {
    const reviewAuthor = await createTestUser(testDb);
    const firstActor = await createTestUser(testDb);
    const secondActor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: reviewAuthor.id });

    await createReviewReplyService(
      { body: "Author participates", reviewId: review.id },
      createAuthenticatedContext(testDb, reviewAuthor)
    );
    await createReviewReplyService(
      { body: "First external reply", reviewId: review.id },
      createAuthenticatedContext(testDb, firstActor)
    );

    await testDb
      .update(notifications)
      .set({ seenAt: new Date() })
      .where(and(eq(notifications.recipientUserId, reviewAuthor.id), eq(notifications.type, "review_replied")));

    const latestReply = await createReviewReplyService(
      { body: "Second external reply", reviewId: review.id },
      createAuthenticatedContext(testDb, secondActor)
    );
    const storedNotifications = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, "review_replied"));
    const authorNotification = storedNotifications.find((row) => row.recipientUserId === reviewAuthor.id);

    expect(storedNotifications.map((row) => row.recipientUserId).sort()).toEqual(
      [firstActor.id, reviewAuthor.id].sort()
    );
    expect(authorNotification).toMatchObject({
      actorUserId: secondActor.id,
      replyId: latestReply.id,
      seenAt: null,
    });
  });

  it("rejects a reply when the root review is not visible", async () => {
    const bannedAuthor = await createTestUser(testDb, { banned: true });
    const actor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: bannedAuthor.id });

    await expect(
      createReviewReplyService({ body: "Hidden", reviewId: review.id }, createAuthenticatedContext(testDb, actor))
    ).rejects.toThrow("Review not found");
  });

  it("serializes concurrent replies so the later actor notifies the earlier actor as a participant", async () => {
    const databaseUrl = process.env.DATABASE_TEST_URL;
    if (!databaseUrl) throw new Error("DATABASE_TEST_URL is required");

    const reviewAuthor = await createTestUser(testDb);
    const existingParticipant = await createTestUser(testDb);
    const firstActor = await createTestUser(testDb);
    const secondActor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: reviewAuthor.id });
    await createTestReviewReply(testDb, { reviewId: review.id, userId: existingParticipant.id });
    const concurrentClient = postgres(databaseUrl, { max: 4, prepare: false });
    const concurrentDb = drizzle({ client: concurrentClient, schema });

    try {
      await Promise.all([
        createReviewReplyService(
          { body: "Concurrent first", reviewId: review.id },
          createAuthenticatedContext(concurrentDb, firstActor)
        ),
        createReviewReplyService(
          { body: "Concurrent second", reviewId: review.id },
          createAuthenticatedContext(concurrentDb, secondActor)
        ),
      ]);
    } finally {
      await concurrentClient.end();
    }

    const storedNotifications = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.type, "review_replied"));
    const actorRecipients = storedNotifications.filter(
      (row) => row.recipientUserId === firstActor.id || row.recipientUserId === secondActor.id
    );

    expect(storedNotifications.map((row) => row.recipientUserId)).toEqual(
      expect.arrayContaining([reviewAuthor.id, existingParticipant.id])
    );
    expect(actorRecipients).toHaveLength(1);
  });
});

describe("deleteReviewReplyService", () => {
  it("allows owner deletion and returns the authoritative replacement summary", async () => {
    const rootAuthor = await createTestUser(testDb);
    const replyAuthor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: rootAuthor.id });
    const firstReply = await createTestReviewReply(testDb, {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      reviewId: review.id,
      userId: replyAuthor.id,
    });
    await createTestReviewReply(testDb, {
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      reviewId: review.id,
      userId: rootAuthor.id,
    });

    await expect(
      deleteReviewReplyService({ replyId: firstReply.id }, createAuthenticatedContext(testDb, replyAuthor))
    ).resolves.toMatchObject({
      id: firstReply.id,
      replyCount: 1,
      reviewId: review.id,
    });
  });

  it("rejects non-owner deletion and permits admin deletion", async () => {
    const replyAuthor = await createTestUser(testDb);
    const otherUser = await createTestUser(testDb);
    const admin = await createTestUser(testDb, { role: "admin" });
    const reply = await createTestReviewReply(testDb, { userId: replyAuthor.id });

    await expect(
      deleteReviewReplyService({ replyId: reply.id }, createAuthenticatedContext(testDb, otherUser))
    ).rejects.toThrow("Reply not found");
    await expect(
      deleteReviewReplyService({ replyId: reply.id }, createAuthenticatedContext(testDb, admin, { isAdmin: true }))
    ).resolves.toMatchObject({ id: reply.id });
  });
});

describe("setReviewReplyLikeService", () => {
  it("is idempotent, excludes banned likers from counts, and creates one reply-like notification", async () => {
    const replyAuthor = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const bannedLiker = await createTestUser(testDb, { banned: true });
    const reply = await createTestReviewReply(testDb, { userId: replyAuthor.id });
    await createTestReviewReplyLike(testDb, { replyId: reply.id, userId: bannedLiker.id });
    const context = createAuthenticatedContext(testDb, liker);

    await setReviewReplyLikeService({ liked: true, replyId: reply.id }, context);
    const result = await setReviewReplyLikeService({ liked: true, replyId: reply.id }, context);
    const storedLikes = await testDb.select().from(reviewReplyLikes).where(eq(reviewReplyLikes.replyId, reply.id));
    const storedNotifications = await testDb.select().from(notifications).where(eq(notifications.type, "reply_liked"));

    expect(result).toEqual({ liked: true, likes: 1, replyId: reply.id });
    expect(storedLikes).toHaveLength(2);
    expect(storedNotifications).toMatchObject([
      { actorUserId: liker.id, recipientUserId: replyAuthor.id, replyId: reply.id },
    ]);
  });

  it("suppresses self-like notifications and makes an unliked notification non-renderable", async () => {
    const replyAuthor = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const reply = await createTestReviewReply(testDb, { userId: replyAuthor.id });

    await setReviewReplyLikeService(
      { liked: true, replyId: reply.id },
      createAuthenticatedContext(testDb, replyAuthor)
    );
    expect(await testDb.select().from(notifications)).toEqual([]);

    const likerContext = createAuthenticatedContext(testDb, liker);
    await setReviewReplyLikeService({ liked: true, replyId: reply.id }, likerContext);
    await setReviewReplyLikeService({ liked: false, replyId: reply.id }, likerContext);

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, replyAuthor));
    expect(page.items).toEqual([]);
  });
});

describe("review-card reply counts", () => {
  it("hydrates album review pages with counts and no arbitrary reply previews", async () => {
    const album = await createTestAlbum(testDb);
    const discussedReview = await createTestReview(testDb, { albumId: album.id });
    const quietReview = await createTestReview(testDb, { albumId: album.id });
    const replyAuthor = await createTestUser(testDb);
    await createTestReviewReply(testDb, { reviewId: discussedReview.id, userId: replyAuthor.id });

    const page = await getAlbumReviewsService({ albumId: album.id });
    const discussed = page.reviews.find((review) => review.id === discussedReview.id);
    const quiet = page.reviews.find((review) => review.id === quietReview.id);

    expect(discussed?.replyCount).toBe(1);
    expect(quiet?.replyCount).toBe(0);
  });

  it("hydrates profile review counts without reply previews", async () => {
    const profileUser = await createTestUser(testDb);
    const otherAuthor = await createTestUser(testDb);
    const replyAuthor = await createTestUser(testDb);
    const ownReview = await createTestReview(testDb, { userId: profileUser.id });
    const likedReview = await createTestReview(testDb, { userId: otherAuthor.id });
    await createTestReviewLike(testDb, { reviewId: likedReview.id, userId: profileUser.id });
    await createTestReviewReply(testDb, { reviewId: ownReview.id, userId: replyAuthor.id });
    await createTestReviewReply(testDb, { reviewId: likedReview.id, userId: replyAuthor.id });

    const reviewsPage = await getUserReviewsService({ userId: profileUser.id });
    const likedPage = await getUserLikedReviewsService({ userId: profileUser.id });

    expect(reviewsPage.reviews[0]).toMatchObject({ replyCount: 1 });
    expect(likedPage.reviews[0]).toMatchObject({ replyCount: 1 });
    expect(reviewsPage.reviews[0]).not.toHaveProperty("replySummary");
    expect(likedPage.reviews[0]).not.toHaveProperty("replySummary");
  });
});

describe("reply cascades", () => {
  it("deleting a review cascades replies, reply likes, and reply-targeted notifications", async () => {
    const reviewAuthor = await createTestUser(testDb);
    const replyAuthor = await createTestUser(testDb);
    const liker = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: reviewAuthor.id });
    const reply = await createReviewReplyService(
      { body: "Cascade me", reviewId: review.id },
      createAuthenticatedContext(testDb, replyAuthor)
    );
    await setReviewReplyLikeService({ liked: true, replyId: reply.id }, createAuthenticatedContext(testDb, liker));

    await testDb.delete(reviews).where(eq(reviews.id, review.id));

    expect(await testDb.select().from(reviewReplies)).toEqual([]);
    expect(await testDb.select().from(reviewReplyLikes)).toEqual([]);
    expect(await testDb.select().from(notifications)).toEqual([]);
  });
});
