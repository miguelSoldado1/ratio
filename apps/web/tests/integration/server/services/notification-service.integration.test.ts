import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import {
  createAuthenticatedContext,
  createTestNotification,
  createTestReview,
  createTestReviewLike,
  createTestReviewReply,
  createTestReviewReplyLike,
  createTestUser,
} from "@test/fixtures";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notifications, reviewReplies, reviewReplyLikes } from "@/lib/db/schema";
import {
  createReplyLikedNotification,
  createReviewLikedNotification,
  createReviewRepliedNotifications,
  createUserFollowedNotification,
  getNotificationsService,
  getUnseenNotificationCountService,
  markNotificationsSeenService,
} from "@/server/services/notification-service";

beforeAll(async () => {
  await migrateTestDatabase();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("createReviewLikedNotification", () => {
  it("upserts an existing actor and review notification and resets seenAt", async () => {
    const author = await createTestUser(testDb);
    const actor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const seenAt = new Date("2020-01-01T10:00:00.000Z");
    const existingNotification = await createTestNotification(testDb, {
      actorUserId: actor.id,
      createdAt: new Date("2020-01-01T09:00:00.000Z"),
      recipientUserId: author.id,
      reviewId: review.id,
      seenAt,
      type: "review_liked",
    });

    const notification = await createReviewLikedNotification({ actorUserId: actor.id, reviewId: review.id }, testDb);

    const [storedNotification] = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, existingNotification.id))
      .limit(1);

    expect(notification).toMatchObject({ id: existingNotification.id, seenAt: null });
    expect(storedNotification).toMatchObject({
      actorUserId: actor.id,
      id: existingNotification.id,
      recipientUserId: author.id,
      reviewId: review.id,
      seenAt: null,
      type: "review_liked",
    });
    expect(storedNotification.createdAt.getTime()).toBeGreaterThan(existingNotification.createdAt.getTime());
  });
});

describe("createUserFollowedNotification", () => {
  it("skips self-notifications", async () => {
    const testUser = await createTestUser(testDb);

    await expect(
      createUserFollowedNotification({ actorUserId: testUser.id, recipientUserId: testUser.id }, testDb)
    ).resolves.toBeNull();

    const storedNotifications = await testDb.select().from(notifications);

    expect(storedNotifications).toEqual([]);
  });
});

describe("getUnseenNotificationCountService", () => {
  it("groups multiple likes on the same review as one unseen notification group", async () => {
    const author = await createTestUser(testDb);
    const firstActor = await createTestUser(testDb);
    const secondActor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const context = createAuthenticatedContext(testDb, author);

    await createTestReviewLike(testDb, { reviewId: review.id, userId: firstActor.id });
    await createTestReviewLike(testDb, { reviewId: review.id, userId: secondActor.id });
    await createReviewLikedNotification({ actorUserId: firstActor.id, reviewId: review.id }, testDb);
    await createReviewLikedNotification({ actorUserId: secondActor.id, reviewId: review.id }, testDb);

    await expect(getUnseenNotificationCountService(context)).resolves.toEqual({ count: 1 });
  });

  it("counts review likes and replies on the same review as separate unseen groups", async () => {
    const author = await createTestUser(testDb);
    const likeActor = await createTestUser(testDb);
    const replyActor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: author.id });
    const reply = await createTestReviewReply(testDb, { reviewId: review.id, userId: replyActor.id });

    await createTestReviewLike(testDb, { reviewId: review.id, userId: likeActor.id });
    await createReviewLikedNotification({ actorUserId: likeActor.id, reviewId: review.id }, testDb);
    await createReviewRepliedNotifications(
      { actorUserId: replyActor.id, replyId: reply.id, reviewId: review.id },
      testDb
    );

    await expect(getUnseenNotificationCountService(createAuthenticatedContext(testDb, author))).resolves.toEqual({
      count: 2,
    });
  });
});

describe("markNotificationsSeenService", () => {
  it("marks only the current user's unseen notifications", async () => {
    const currentUser = await createTestUser(testDb);
    const otherRecipient = await createTestUser(testDb);
    const firstActor = await createTestUser(testDb);
    const secondActor = await createTestUser(testDb);
    const thirdActor = await createTestUser(testDb);

    await createTestNotification(testDb, {
      actorUserId: firstActor.id,
      createdAt: new Date("2020-01-01T09:00:00.000Z"),
      recipientUserId: currentUser.id,
      seenAt: null,
      type: "user_followed",
    });
    await createTestNotification(testDb, {
      actorUserId: secondActor.id,
      createdAt: new Date("2020-01-01T09:00:00.000Z"),
      recipientUserId: currentUser.id,
      seenAt: new Date("2026-07-04T10:00:00.000Z"),
      type: "user_followed",
    });
    await createTestNotification(testDb, {
      actorUserId: thirdActor.id,
      createdAt: new Date("2020-01-01T09:00:00.000Z"),
      recipientUserId: otherRecipient.id,
      seenAt: null,
      type: "user_followed",
    });

    await expect(markNotificationsSeenService(createAuthenticatedContext(testDb, currentUser))).resolves.toEqual({
      seenCount: 1,
    });

    const currentUserSeenNotifications = await testDb
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, currentUser.id), isNotNull(notifications.seenAt)));
    const currentUserUnseenNotifications = await testDb
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, currentUser.id), isNull(notifications.seenAt)));
    const otherUserUnseenNotifications = await testDb
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, otherRecipient.id), isNull(notifications.seenAt)));

    expect(currentUserSeenNotifications).toHaveLength(2);
    expect(currentUserUnseenNotifications).toEqual([]);
    expect(otherUserUnseenNotifications).toHaveLength(1);
  });
});

describe("getNotificationsService", () => {
  it("stores reply notification timestamps at cursor-safe millisecond precision", async () => {
    const reviewAuthor = await createTestUser(testDb);
    const replyAuthor = await createTestUser(testDb);
    const likeActor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: reviewAuthor.id });
    const reply = await createTestReviewReply(testDb, { reviewId: review.id, userId: replyAuthor.id });

    await createReviewRepliedNotifications(
      { actorUserId: replyAuthor.id, replyId: reply.id, reviewId: review.id },
      testDb
    );
    await createReplyLikedNotification({ actorUserId: likeActor.id, replyId: reply.id }, testDb);

    const rows = await testDb
      .select({
        submillisecondMicroseconds: sql<number>`(extract(microseconds from ${notifications.createdAt})::int % 1000)`,
        type: notifications.type,
      })
      .from(notifications)
      .where(inArray(notifications.type, ["review_replied", "reply_liked"]));

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.submillisecondMicroseconds)).toEqual([0, 0]);
  });

  it("returns user_followed notifications with actor, href, text, and seen state", async () => {
    const recipient = await createTestUser(testDb);
    const actor = await createTestUser(testDb, {
      displayUsername: "Alice Listener",
      username: "alice",
    });

    await createUserFollowedNotification({ actorUserId: actor.id, recipientUserId: recipient.id }, testDb);

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, recipient));

    expect(page.items).toEqual([
      expect.objectContaining({
        actor: expect.objectContaining({
          id: actor.id,
          username: "alice",
        }),
        href: "/user/alice",
        seen: false,
        text: "Alice Listener followed you",
        type: "user_followed",
      }),
    ]);
  });

  it("returns grouped review_liked notifications with actor count and top actors", async () => {
    const recipient = await createTestUser(testDb);
    const actors = await createUsers(4);
    const review = await createTestReview(testDb, { userId: recipient.id });

    for (const actor of actors) {
      await createTestReviewLike(testDb, { reviewId: review.id, userId: actor.id });
      await createReviewLikedNotification({ actorUserId: actor.id, reviewId: review.id }, testDb);
    }

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, recipient));
    const [item] = page.items;

    expect(item).toMatchObject({
      actorCount: 4,
      albumId: review.albumId,
      href: `/review/${review.id}`,
      reviewId: review.id,
      seen: false,
      type: "review_liked",
    });
    expect(item?.type === "review_liked" ? item.actors : []).toHaveLength(3);
  });

  it("excludes banned actors", async () => {
    const recipient = await createTestUser(testDb);
    const bannedActor = await createTestUser(testDb, { banned: true });

    await createUserFollowedNotification({ actorUserId: bannedActor.id, recipientUserId: recipient.id }, testDb);

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, recipient));

    expect(page.items).toEqual([]);
  });

  it("excludes stale review-like notifications when the actor no longer likes the review", async () => {
    const recipient = await createTestUser(testDb);
    const actor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: recipient.id });

    await createReviewLikedNotification({ actorUserId: actor.id, reviewId: review.id }, testDb);

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, recipient));

    expect(page.items).toEqual([]);
  });

  it("cursor pagination has no duplicates", async () => {
    const recipient = await createTestUser(testDb);
    const actors = await createUsers(19);

    for (const [index, actor] of actors.entries()) {
      await createTestNotification(testDb, {
        actorUserId: actor.id,
        createdAt: new Date(Date.UTC(2026, 6, 4, 0, index)),
        recipientUserId: recipient.id,
        seenAt: null,
        type: "user_followed",
      });
    }

    const firstPage = await getNotificationsService({}, createAuthenticatedContext(testDb, recipient));
    const secondPage = await getNotificationsService(
      { cursor: firstPage.nextCursor ?? undefined },
      createAuthenticatedContext(testDb, recipient)
    );
    const returnedKeys = [...firstPage.items, ...secondPage.items].map((item) => item.key);

    expect(firstPage.items).toHaveLength(18);
    expect(secondPage.items).toHaveLength(1);
    expect(new Set(returnedKeys).size).toBe(returnedKeys.length);
  });

  it("maps seen state correctly", async () => {
    const recipient = await createTestUser(testDb);
    const unseenActor = await createTestUser(testDb);
    const seenActor = await createTestUser(testDb);

    await createTestNotification(testDb, {
      actorUserId: unseenActor.id,
      createdAt: new Date("2026-07-04T10:00:00.000Z"),
      recipientUserId: recipient.id,
      seenAt: null,
      type: "user_followed",
    });
    await createTestNotification(testDb, {
      actorUserId: seenActor.id,
      createdAt: new Date("2026-07-04T09:00:00.000Z"),
      recipientUserId: recipient.id,
      seenAt: new Date("2026-07-04T09:30:00.000Z"),
      type: "user_followed",
    });

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, recipient));

    expect(page.items.map((item) => item.seen)).toEqual([false, true]);
  });

  it("hydrates review likes and replies on the same review as separate groups", async () => {
    const recipient = await createTestUser(testDb);
    const replyActor = await createTestUser(testDb, { displayUsername: "Carly" });
    const likeActor = await createTestUser(testDb, { displayUsername: "Drew" });
    const review = await createTestReview(testDb, { userId: recipient.id });
    const reply = await createTestReviewReply(testDb, { reviewId: review.id, userId: replyActor.id });
    await createTestReviewLike(testDb, { reviewId: review.id, userId: likeActor.id });
    await createReviewLikedNotification({ actorUserId: likeActor.id, reviewId: review.id }, testDb);
    await createReviewRepliedNotifications(
      { actorUserId: replyActor.id, replyId: reply.id, reviewId: review.id },
      testDb
    );

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, recipient));

    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.type).sort()).toEqual(["review_liked", "review_replied"]);
  });

  it("returns author and participant copy for review replies", async () => {
    const reviewAuthor = await createTestUser(testDb, { displayUsername: "Alice" });
    const participant = await createTestUser(testDb, { displayUsername: "Bob" });
    const actor = await createTestUser(testDb, { displayUsername: "Carly" });
    const review = await createTestReview(testDb, { userId: reviewAuthor.id });
    await createTestReviewReply(testDb, { reviewId: review.id, userId: participant.id });
    const triggeringReply = await createTestReviewReply(testDb, { reviewId: review.id, userId: actor.id });
    await createReviewRepliedNotifications(
      { actorUserId: actor.id, replyId: triggeringReply.id, reviewId: review.id },
      testDb
    );

    const authorPage = await getNotificationsService({}, createAuthenticatedContext(testDb, reviewAuthor));
    const participantPage = await getNotificationsService({}, createAuthenticatedContext(testDb, participant));

    expect(authorPage.items).toMatchObject([
      {
        href: `/review/${review.id}`,
        recipientOwnsReview: true,
        text: "Carly replied to your review.",
        type: "review_replied",
      },
    ]);
    expect(participantPage.items).toMatchObject([
      {
        recipientOwnsReview: false,
        text: "Carly also replied to Alice's review.",
        type: "review_replied",
      },
    ]);
  });

  it("groups reply likes and excludes the group after all source likes disappear", async () => {
    const replyAuthor = await createTestUser(testDb);
    const firstActor = await createTestUser(testDb, { displayUsername: "Carly" });
    const secondActor = await createTestUser(testDb, { displayUsername: "Drew" });
    const reply = await createTestReviewReply(testDb, { userId: replyAuthor.id });

    for (const actor of [firstActor, secondActor]) {
      await createTestReviewReplyLike(testDb, { replyId: reply.id, userId: actor.id });
      await createReplyLikedNotification({ actorUserId: actor.id, replyId: reply.id }, testDb);
    }

    const page = await getNotificationsService({}, createAuthenticatedContext(testDb, replyAuthor));
    expect(page.items).toMatchObject([
      {
        actorCount: 2,
        replyId: reply.id,
        text: expect.stringContaining("liked your reply"),
        type: "reply_liked",
      },
    ]);

    await testDb
      .delete(reviewReplyLikes)
      .where(and(eq(reviewReplyLikes.replyId, reply.id), eq(reviewReplyLikes.userId, firstActor.id)));

    const pageAfterUnlike = await getNotificationsService({}, createAuthenticatedContext(testDb, replyAuthor));
    const [itemAfterUnlike] = pageAfterUnlike.items;

    expect(itemAfterUnlike).toMatchObject({ actorCount: 1, type: "reply_liked" });
    expect(itemAfterUnlike?.type === "reply_liked" ? itemAfterUnlike.actors.map((actor) => actor.id) : []).toEqual([
      secondActor.id,
    ]);

    await testDb.delete(reviewReplyLikes);
    await expect(getNotificationsService({}, createAuthenticatedContext(testDb, replyAuthor))).resolves.toMatchObject({
      items: [],
    });
  });

  it("drops the latest reply notification after its triggering reply is deleted", async () => {
    const reviewAuthor = await createTestUser(testDb);
    const actor = await createTestUser(testDb);
    const review = await createTestReview(testDb, { userId: reviewAuthor.id });
    const reply = await createTestReviewReply(testDb, { reviewId: review.id, userId: actor.id });
    const context = createAuthenticatedContext(testDb, reviewAuthor);

    await createReviewRepliedNotifications({ actorUserId: actor.id, replyId: reply.id, reviewId: review.id }, testDb);
    await expect(getUnseenNotificationCountService(context)).resolves.toEqual({ count: 1 });

    await testDb.delete(reviewReplies).where(eq(reviewReplies.id, reply.id));

    await expect(testDb.select().from(notifications)).resolves.toEqual([]);
    await expect(getNotificationsService({}, context)).resolves.toMatchObject({ items: [] });
    await expect(getUnseenNotificationCountService(context)).resolves.toEqual({ count: 0 });
  });

  it("does not render a review reply notification whose reply does not match its review", async () => {
    const recipient = await createTestUser(testDb);
    const actor = await createTestUser(testDb);
    const targetReview = await createTestReview(testDb, { userId: recipient.id });
    const otherReview = await createTestReview(testDb);
    const otherReply = await createTestReviewReply(testDb, { reviewId: otherReview.id, userId: actor.id });
    await createTestNotification(testDb, {
      actorUserId: actor.id,
      recipientUserId: recipient.id,
      replyId: otherReply.id,
      reviewId: targetReview.id,
      type: "review_replied",
    });

    await expect(getNotificationsService({}, createAuthenticatedContext(testDb, recipient))).resolves.toMatchObject({
      items: [],
    });
  });
});

async function createUsers(count: number) {
  return await Promise.all(Array.from({ length: count }, () => createTestUser(testDb)));
}
