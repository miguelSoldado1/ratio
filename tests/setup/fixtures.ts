import { albums, notifications, reviewLikes, reviews, user, userFollows } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "@/server/auth-middleware";

let sequence = 0;

export async function createTestUser(db: Db, overrides: Partial<typeof user.$inferInsert> = {}) {
  const next = nextSequence();
  const values = {
    displayUsername: `Test User ${next}`,
    email: `test-user-${next}@example.com`,
    emailVerified: true,
    id: `test_user_${next}`,
    name: `Test User ${next}`,
    username: `test_user_${next}`,
    ...overrides,
  } satisfies typeof user.$inferInsert;

  const [createdUser] = await db.insert(user).values(values).returning();

  return createdUser;
}

export async function createTestAlbum(db: Db, overrides: Partial<typeof albums.$inferInsert> = {}) {
  const next = nextSequence();
  const values = {
    artistNames: [`Test Artist ${next}`],
    id: `spotify_album_${next}`,
    releaseYear: 2026,
    title: `Test Album ${next}`,
    totalTracks: 10,
    ...overrides,
  } satisfies typeof albums.$inferInsert;

  const [createdAlbum] = await db.insert(albums).values(values).returning();

  return createdAlbum;
}

export async function createTestReview(db: Db, overrides: Partial<typeof reviews.$inferInsert> = {}) {
  const next = nextSequence();
  const values = {
    albumId: overrides.albumId ?? (await createTestAlbum(db)).id,
    body: `Test review ${next}`,
    rating: 8,
    shareCode: `Share${next.toString().padStart(5, "0")}`,
    userId: overrides.userId ?? (await createTestUser(db)).id,
    ...overrides,
  } satisfies typeof reviews.$inferInsert;

  const [createdReview] = await db.insert(reviews).values(values).returning();

  return createdReview;
}

export async function createTestReviewLike(db: Db, overrides: typeof reviewLikes.$inferInsert) {
  const [createdReviewLike] = await db.insert(reviewLikes).values(overrides).returning();

  return createdReviewLike;
}

export async function createTestNotification(db: Db, overrides: typeof notifications.$inferInsert) {
  const [createdNotification] = await db.insert(notifications).values(overrides).returning();

  return createdNotification;
}

export async function createTestUserFollow(db: Db, overrides: typeof userFollows.$inferInsert) {
  const [createdUserFollow] = await db.insert(userFollows).values(overrides).returning();

  return createdUserFollow;
}

export function createAuthenticatedContext(
  db: Db,
  testUser: Pick<typeof user.$inferSelect, "id">,
  options: { isAdmin?: boolean } = {}
): AuthenticatedContext {
  return {
    db,
    user: {
      id: testUser.id,
      isAdmin: options.isAdmin ?? false,
    },
  };
}

function nextSequence() {
  sequence += 1;
  return sequence;
}
