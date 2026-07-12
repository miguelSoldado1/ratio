import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import { createTestAlbum, createTestReview, createTestReviewLike, createTestUser } from "@test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAlbumReviewsService,
  getReviewByShareCodeService,
  getUserLikedReviewsService,
  getUserProfileService,
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

vi.mock("@/server/services/spotify-service", () => ({
  getAlbumPersistenceMetadata: vi.fn(() => {
    throw new Error("Spotify should not be called by visibility tests");
  }),
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

describe("public banned-user visibility", () => {
  it("hides banned profiles from public profile reads", async () => {
    const bannedUser = await createTestUser(testDb, { banned: true, username: "banned_user" });

    await expect(getUserProfileService({ username: bannedUser.username ?? "" })).rejects.toThrow("User not found");
  });

  it("hides banned review details from public review reads", async () => {
    const bannedUser = await createTestUser(testDb, { banned: true });
    const album = await createTestAlbum(testDb);
    const review = await createTestReview(testDb, { albumId: album.id, userId: bannedUser.id });

    await expect(getReviewByShareCodeService({ albumId: album.id, reviewCode: review.shareCode })).rejects.toThrow(
      "Review not found"
    );
  });

  it("hides banned users from public album review reads", async () => {
    const visibleUser = await createTestUser(testDb);
    const bannedUser = await createTestUser(testDb, { banned: true });
    const album = await createTestAlbum(testDb);
    const visibleReview = await createTestReview(testDb, { albumId: album.id, userId: visibleUser.id });

    await createTestReview(testDb, { albumId: album.id, userId: bannedUser.id });

    await expect(getAlbumReviewsService({ albumId: album.id })).resolves.toMatchObject({
      reviews: [expect.objectContaining({ id: visibleReview.id })],
    });
  });

  it("hides banned users from public user review reads", async () => {
    const bannedUser = await createTestUser(testDb, { banned: true });
    await createTestReview(testDb, { userId: bannedUser.id });

    await expect(getUserReviewsService({ userId: bannedUser.id })).resolves.toEqual({
      nextCursor: null,
      reviews: [],
    });
  });

  it("hides liked reviews written by banned users", async () => {
    const profileUser = await createTestUser(testDb);
    const bannedAuthor = await createTestUser(testDb, { banned: true });
    const review = await createTestReview(testDb, { userId: bannedAuthor.id });
    await createTestReviewLike(testDb, { reviewId: review.id, userId: profileUser.id });

    await expect(getUserLikedReviewsService({ userId: profileUser.id })).resolves.toEqual({
      nextCursor: null,
      reviews: [],
    });
  });
});

describe("user liked reviews", () => {
  it("returns reviews in newest-like-first order with their authors and albums", async () => {
    const profileUser = await createTestUser(testDb);
    const firstAuthor = await createTestUser(testDb, { displayUsername: "First Author" });
    const secondAuthor = await createTestUser(testDb, { displayUsername: "Second Author" });
    const firstReview = await createTestReview(testDb, { userId: firstAuthor.id });
    const secondReview = await createTestReview(testDb, { userId: secondAuthor.id });

    await createTestReviewLike(testDb, {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      reviewId: firstReview.id,
      userId: profileUser.id,
    });
    await createTestReviewLike(testDb, {
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      reviewId: secondReview.id,
      userId: profileUser.id,
    });

    await expect(getUserLikedReviewsService({ userId: profileUser.id })).resolves.toMatchObject({
      nextCursor: null,
      reviews: [
        {
          id: secondReview.id,
          liked: false,
          user: { displayUsername: "Second Author" },
        },
        {
          id: firstReview.id,
          liked: false,
          user: { displayUsername: "First Author" },
        },
      ],
    });
  });
});

describe("admin banned-user visibility", () => {
  it("allows admins to access banned profiles", async () => {
    const admin = await createTestUser(testDb, { role: "admin" });
    const bannedUser = await createTestUser(testDb, { banned: true, username: "banned_user" });
    mockState.currentUser = { id: admin.id, isAdmin: true };

    await expect(getUserProfileService({ username: bannedUser.username ?? "" })).resolves.toMatchObject({
      user: expect.objectContaining({ banned: true, id: bannedUser.id }),
    });
  });

  it("allows admins to access banned review details", async () => {
    const admin = await createTestUser(testDb, { role: "admin" });
    const bannedUser = await createTestUser(testDb, { banned: true });
    const album = await createTestAlbum(testDb);
    const review = await createTestReview(testDb, { albumId: album.id, userId: bannedUser.id });
    mockState.currentUser = { id: admin.id, isAdmin: true };

    await expect(
      getReviewByShareCodeService({ albumId: album.id, reviewCode: review.shareCode })
    ).resolves.toMatchObject({
      id: review.id,
    });
  });
});
