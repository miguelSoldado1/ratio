import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import { createTestAlbum, createTestReview, createTestUser } from "@test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAlbumReviewsService,
  getReviewByShareCodeService,
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
