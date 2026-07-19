import { albums, reviewLikes, reviews, user } from "@ratio/database/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteReviewService, getTableReviewsService } from "@/server/services/review-service";
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

describe("getTableReviewsService", () => {
  it("searches and sorts by the identity displayed in the table", async () => {
    const alphaUser = await createUser({
      displayUsername: "AlphaDisplay",
      id: "alpha_user",
      name: "Zulu Legal Name",
      username: "alpha_handle",
    });
    const zuluUser = await createUser({
      displayUsername: "ZuluDisplay",
      id: "zulu_user",
      name: "Alpha Legal Name",
      username: "zulu_handle",
    });
    const alphaReview = await createReview(alphaUser.id, "alpha_album");
    const zuluReview = await createReview(zuluUser.id, "zulu_album");
    const likerOne = await createUser({ id: "liker_one", name: "Liker One", username: "liker_one" });
    const likerTwo = await createUser({ id: "liker_two", name: "Liker Two", username: "liker_two" });

    await testDb.insert(reviewLikes).values([
      { reviewId: alphaReview.id, userId: likerOne.id },
      { reviewId: alphaReview.id, userId: likerTwo.id },
    ]);

    const sortedPage = await getTableReviewsService(
      { filters: {}, limit: 10, page: 1, sorting: [{ desc: false, id: "user" }] },
      { db: testDb }
    );

    expect(sortedPage.data.map((review) => review.id)).toEqual([alphaReview.id, zuluReview.id]);
    expect(sortedPage.data[0].likeCount).toBe(2);

    const displayNamePage = await getTableReviewsService(
      { filters: { user: "AlphaDisplay" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );
    const usernamePage = await getTableReviewsService(
      { filters: { user: "zulu_handle" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );

    expect(displayNamePage.data.map((review) => review.id)).toEqual([alphaReview.id]);
    expect(usernamePage.data.map((review) => review.id)).toEqual([zuluReview.id]);
  });

  it("searches albums by title and artist name", async () => {
    const author = await createUser({ id: "album_author", name: "Album Author", username: "album_author" });
    const review = await createReview(author.id, "search_album", {
      artistNames: ["The Satellites", "Guest Artist"],
      title: "Midnight Signals",
    });

    const titlePage = await getTableReviewsService(
      { filters: { album: "Midnight" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );
    const artistPage = await getTableReviewsService(
      { filters: { album: "Satellites" }, limit: 10, page: 1, sorting: [] },
      { db: testDb }
    );

    expect(titlePage.data.map((item) => item.id)).toEqual([review.id]);
    expect(artistPage.data.map((item) => item.id)).toEqual([review.id]);
  });
});

describe("deleteReviewService", () => {
  it("deletes the review and cascades its likes", async () => {
    const author = await createUser({ id: "author", name: "Author", username: "author" });
    const liker = await createUser({ id: "liker", name: "Liker", username: "liker" });
    const review = await createReview(author.id, "delete_album");
    await testDb.insert(reviewLikes).values({ reviewId: review.id, userId: liker.id });

    await expect(deleteReviewService(review.id, { db: testDb })).resolves.toEqual({ id: review.id });

    await expect(testDb.select().from(reviews).where(eq(reviews.id, review.id))).resolves.toEqual([]);
    await expect(testDb.select().from(reviewLikes).where(eq(reviewLikes.reviewId, review.id))).resolves.toEqual([]);
  });
});

async function createUser(
  overrides: Pick<typeof user.$inferInsert, "id" | "name" | "username"> & Partial<typeof user.$inferInsert>
) {
  const [createdUser] = await testDb
    .insert(user)
    .values({
      displayUsername: overrides.name,
      email: `${overrides.id}@example.com`,
      emailVerified: true,
      ...overrides,
    })
    .returning();

  return createdUser;
}

async function createReview(userId: string, albumId: string, albumOverrides: Partial<typeof albums.$inferInsert> = {}) {
  await testDb.insert(albums).values({
    artistNames: ["Test Artist"],
    id: albumId,
    releaseDate: "2026-01-01",
    title: `Album ${albumId}`,
    totalTracks: 10,
    ...albumOverrides,
  });

  const [review] = await testDb
    .insert(reviews)
    .values({ albumId, body: `Review ${albumId}`, rating: 8, userId })
    .returning();

  return review;
}
