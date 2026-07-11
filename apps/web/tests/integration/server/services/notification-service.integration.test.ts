import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import {
  createAuthenticatedContext,
  createTestNotification,
  createTestReview,
  createTestReviewLike,
  createTestUser,
} from "@test/fixtures";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notifications } from "@/lib/db/schema";
import {
  createReviewLikedNotification,
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
      href: `/album/${review.albumId}/r/${review.shareCode}`,
      reviewCode: review.shareCode,
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
});

async function createUsers(count: number) {
  return await Promise.all(Array.from({ length: count }, () => createTestUser(testDb)));
}
