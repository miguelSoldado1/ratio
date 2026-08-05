import { albums, listItems, lists, reviewReplies, reviews, user } from "@ratio/database/schema";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getOverviewStatsService } from "@/server/services/overview-service";
import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "./setup/db";

beforeAll(async () => {
  await migrateTestDatabase();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("getOverviewStatsService", () => {
  it("counts current and previous 30-day community activity", async () => {
    const now = Date.now();
    const currentDate = new Date(now - 10 * 24 * 60 * 60 * 1000);
    const previousDate = new Date(now - 40 * 24 * 60 * 60 * 1000);
    const olderDate = new Date(now - 70 * 24 * 60 * 60 * 1000);
    const currentUser = await createUser("current_user", currentDate);
    const previousUser = await createUser("previous_user", previousDate);
    const olderUser = await createUser("older_user", olderDate);

    await testDb
      .insert(albums)
      .values([createAlbum("current_album"), createAlbum("previous_album"), createAlbum("older_album")]);

    const createdReviews = await testDb
      .insert(reviews)
      .values([
        createReview(currentUser.id, "current_album", currentDate),
        createReview(previousUser.id, "previous_album", previousDate),
        createReview(olderUser.id, "older_album", olderDate),
      ])
      .returning();

    await testDb
      .insert(reviewReplies)
      .values([
        createReply(createdReviews[0].id, currentUser.id, currentDate),
        createReply(createdReviews[1].id, previousUser.id, previousDate),
        createReply(createdReviews[2].id, olderUser.id, olderDate),
      ]);

    const createdLists = await testDb
      .insert(lists)
      .values([
        createList(currentUser.id, "Current list", currentDate),
        createList(previousUser.id, "Previous list", previousDate),
        createList(olderUser.id, "Older list", olderDate),
      ])
      .returning();

    await testDb
      .insert(listItems)
      .values([
        createListItem(createdLists[0].id, "current_album", currentDate),
        createListItem(createdLists[1].id, "previous_album", previousDate),
        createListItem(createdLists[2].id, "older_album", olderDate),
      ]);

    await expect(getOverviewStatsService({ db: testDb })).resolves.toEqual({
      listItemsLast30Days: 1,
      listItemsPrev30Days: 1,
      listsLast30Days: 1,
      listsPrev30Days: 1,
      repliesLast30Days: 1,
      repliesPrev30Days: 1,
      reviewsLast30Days: 1,
      reviewsPrev30Days: 1,
      totalUsers: 3,
      usersLast30Days: 1,
      usersPrev30Days: 1,
    });
  });
});

async function createUser(id: string, createdAt: Date) {
  const [createdUser] = await testDb
    .insert(user)
    .values({
      createdAt,
      displayUsername: id,
      email: `${id}@example.com`,
      emailVerified: true,
      id,
      name: id,
      username: id,
    })
    .returning();

  return createdUser;
}

function createAlbum(id: string): typeof albums.$inferInsert {
  return {
    artistNames: ["Test Artist"],
    id,
    releaseDate: "2026-01-01",
    title: id,
    totalTracks: 10,
  };
}

function createReview(userId: string, albumId: string, createdAt: Date): typeof reviews.$inferInsert {
  return {
    albumId,
    body: `${albumId} review`,
    createdAt,
    rating: 8,
    userId,
  };
}

function createReply(reviewId: string, userId: string, createdAt: Date): typeof reviewReplies.$inferInsert {
  return {
    body: `${userId} reply`,
    createdAt,
    reviewId,
    userId,
  };
}

function createList(userId: string, title: string, createdAt: Date): typeof lists.$inferInsert {
  return {
    createdAt,
    title,
    userId,
  };
}

function createListItem(listId: string, albumId: string, createdAt: Date): typeof listItems.$inferInsert {
  return {
    albumId,
    createdAt,
    listId,
    position: 0,
  };
}
