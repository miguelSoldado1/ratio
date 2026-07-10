import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import { createAuthenticatedContext, createTestUser, createTestUserFollow } from "@test/fixtures";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { notifications, userFollows } from "@/lib/db/schema";
import {
  getUserFollowersService,
  getUserFollowingService,
  setUserFollowService,
} from "@/server/services/follow-service";

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

describe("setUserFollowService", () => {
  it("inserts a follow row", async () => {
    const follower = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await expect(setUserFollowService({ following: true, userId: target.id }, context)).resolves.toMatchObject({
      followedByViewer: true,
      followersCount: 1,
      userId: target.id,
    });

    const storedFollows = await getStoredFollows(follower.id, target.id);

    expect(storedFollows).toHaveLength(1);
  });

  it("duplicate follow is idempotent", async () => {
    const follower = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await setUserFollowService({ following: true, userId: target.id }, context);
    const result = await setUserFollowService({ following: true, userId: target.id }, context);

    const storedFollows = await getStoredFollows(follower.id, target.id);

    expect(result.followersCount).toBe(1);
    expect(storedFollows).toHaveLength(1);
  });

  it("unfollow removes the follow row", async () => {
    const follower = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await createTestUserFollow(testDb, { followerId: follower.id, followingId: target.id });

    await expect(setUserFollowService({ following: false, userId: target.id }, context)).resolves.toMatchObject({
      followedByViewer: false,
      followersCount: 0,
      userId: target.id,
    });

    const storedFollows = await getStoredFollows(follower.id, target.id);

    expect(storedFollows).toEqual([]);
  });

  it("unfollow of an absent row is harmless", async () => {
    const follower = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await expect(setUserFollowService({ following: false, userId: target.id }, context)).resolves.toMatchObject({
      followedByViewer: false,
      followersCount: 0,
      userId: target.id,
    });
  });

  it("self-follow throws", async () => {
    const follower = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await expect(setUserFollowService({ following: true, userId: follower.id }, context)).rejects.toThrow(
      "You cannot follow yourself"
    );
  });

  it("missing target throws", async () => {
    const follower = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await expect(setUserFollowService({ following: true, userId: "missing_user" }, context)).rejects.toThrow(
      "User not found"
    );
  });

  it("banned target throws", async () => {
    const follower = await createTestUser(testDb);
    const bannedTarget = await createTestUser(testDb, { banned: true });
    const context = createAuthenticatedContext(testDb, follower);

    await expect(setUserFollowService({ following: true, userId: bannedTarget.id }, context)).rejects.toThrow(
      "User not found"
    );
  });

  it("returned counts exclude banned users", async () => {
    const follower = await createTestUser(testDb);
    const bannedFollower = await createTestUser(testDb, { banned: true });
    const target = await createTestUser(testDb);
    const visibleFollowedUser = await createTestUser(testDb);
    const bannedFollowedUser = await createTestUser(testDb, { banned: true });
    const context = createAuthenticatedContext(testDb, follower);

    await createTestUserFollow(testDb, { followerId: bannedFollower.id, followingId: target.id });
    await createTestUserFollow(testDb, { followerId: target.id, followingId: visibleFollowedUser.id });
    await createTestUserFollow(testDb, { followerId: target.id, followingId: bannedFollowedUser.id });

    const result = await setUserFollowService({ following: true, userId: target.id }, context);

    expect(result).toMatchObject({
      followersCount: 1,
      followingCount: 1,
    });
  });

  it("follow creates a user_followed notification", async () => {
    const follower = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await setUserFollowService({ following: true, userId: target.id }, context);

    const storedNotifications = await testDb.select().from(notifications);

    expect(storedNotifications).toMatchObject([
      {
        actorUserId: follower.id,
        recipientUserId: target.id,
        seenAt: null,
        type: "user_followed",
      },
    ]);
  });

  it("duplicate follow does not duplicate the notification", async () => {
    const follower = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await setUserFollowService({ following: true, userId: target.id }, context);
    await setUserFollowService({ following: true, userId: target.id }, context);

    const storedNotifications = await testDb.select().from(notifications);

    expect(storedNotifications).toHaveLength(1);
  });

  it("unfollow does not delete the historical notification", async () => {
    const follower = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, follower);

    await setUserFollowService({ following: true, userId: target.id }, context);
    await setUserFollowService({ following: false, userId: target.id }, context);

    const storedNotifications = await testDb.select().from(notifications);

    expect(storedNotifications).toHaveLength(1);
  });
});

describe("getUserFollowersService", () => {
  it("returns visible followers and excludes banned users", async () => {
    const target = await createTestUser(testDb);
    const visibleFollower = await createTestUser(testDb);
    const bannedFollower = await createTestUser(testDb, { banned: true });

    await createTestUserFollow(testDb, { followerId: visibleFollower.id, followingId: target.id });
    await createTestUserFollow(testDb, { followerId: bannedFollower.id, followingId: target.id });

    const page = await getUserFollowersService({ userId: target.id });

    expect(page.users).toEqual([
      expect.objectContaining({
        id: visibleFollower.id,
        username: visibleFollower.username,
      }),
    ]);
  });

  it("includes followedByViewer", async () => {
    const viewer = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const follower = await createTestUser(testDb);
    mockState.currentUser = { id: viewer.id, isAdmin: false };

    await createTestUserFollow(testDb, { followerId: follower.id, followingId: target.id });
    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: follower.id });

    const page = await getUserFollowersService({ userId: target.id });

    expect(page.users).toEqual([expect.objectContaining({ followedByViewer: true, id: follower.id })]);
  });

  it("cursor pagination has no duplicates", async () => {
    const target = await createTestUser(testDb);
    const followers = await createUsers(25);

    for (const [index, follower] of followers.entries()) {
      await createTestUserFollow(testDb, {
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        followerId: follower.id,
        followingId: target.id,
      });
    }

    const firstPage = await getUserFollowersService({ userId: target.id });
    const secondPage = await getUserFollowersService({ cursor: firstPage.nextCursor ?? undefined, userId: target.id });
    const returnedIds = [...firstPage.users, ...secondPage.users].map((returnedUser) => returnedUser.id);

    expect(firstPage.users).toHaveLength(24);
    expect(secondPage.users).toHaveLength(1);
    expect(new Set(returnedIds).size).toBe(returnedIds.length);
  });

  it("hides banned profile targets from non-admin users", async () => {
    const bannedTarget = await createTestUser(testDb, { banned: true });

    await expect(getUserFollowersService({ userId: bannedTarget.id })).rejects.toThrow("User not found");
  });

  it("allows admins to read banned profile targets", async () => {
    const admin = await createTestUser(testDb, { role: "admin" });
    const bannedTarget = await createTestUser(testDb, { banned: true });
    const follower = await createTestUser(testDb);
    mockState.currentUser = { id: admin.id, isAdmin: true };

    await createTestUserFollow(testDb, { followerId: follower.id, followingId: bannedTarget.id });

    await expect(getUserFollowersService({ userId: bannedTarget.id })).resolves.toMatchObject({
      users: [expect.objectContaining({ id: follower.id })],
    });
  });
});

describe("getUserFollowingService", () => {
  it("returns visible followed users and excludes banned users", async () => {
    const target = await createTestUser(testDb);
    const visibleFollowedUser = await createTestUser(testDb);
    const bannedFollowedUser = await createTestUser(testDb, { banned: true });

    await createTestUserFollow(testDb, { followerId: target.id, followingId: visibleFollowedUser.id });
    await createTestUserFollow(testDb, { followerId: target.id, followingId: bannedFollowedUser.id });

    const page = await getUserFollowingService({ userId: target.id });

    expect(page.users).toEqual([
      expect.objectContaining({
        id: visibleFollowedUser.id,
        username: visibleFollowedUser.username,
      }),
    ]);
  });

  it("includes followedByViewer", async () => {
    const viewer = await createTestUser(testDb);
    const target = await createTestUser(testDb);
    const followedUser = await createTestUser(testDb);
    mockState.currentUser = { id: viewer.id, isAdmin: false };

    await createTestUserFollow(testDb, { followerId: target.id, followingId: followedUser.id });
    await createTestUserFollow(testDb, { followerId: viewer.id, followingId: followedUser.id });

    const page = await getUserFollowingService({ userId: target.id });

    expect(page.users).toEqual([expect.objectContaining({ followedByViewer: true, id: followedUser.id })]);
  });

  it("cursor pagination has no duplicates", async () => {
    const target = await createTestUser(testDb);
    const followedUsers = await createUsers(25);

    for (const [index, followedUser] of followedUsers.entries()) {
      await createTestUserFollow(testDb, {
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
        followerId: target.id,
        followingId: followedUser.id,
      });
    }

    const firstPage = await getUserFollowingService({ userId: target.id });
    const secondPage = await getUserFollowingService({ cursor: firstPage.nextCursor ?? undefined, userId: target.id });
    const returnedIds = [...firstPage.users, ...secondPage.users].map((returnedUser) => returnedUser.id);

    expect(firstPage.users).toHaveLength(24);
    expect(secondPage.users).toHaveLength(1);
    expect(new Set(returnedIds).size).toBe(returnedIds.length);
  });

  it("hides banned profile targets from non-admin users", async () => {
    const bannedTarget = await createTestUser(testDb, { banned: true });

    await expect(getUserFollowingService({ userId: bannedTarget.id })).rejects.toThrow("User not found");
  });

  it("allows admins to read banned profile targets", async () => {
    const admin = await createTestUser(testDb, { role: "admin" });
    const bannedTarget = await createTestUser(testDb, { banned: true });
    const followedUser = await createTestUser(testDb);
    mockState.currentUser = { id: admin.id, isAdmin: true };

    await createTestUserFollow(testDb, { followerId: bannedTarget.id, followingId: followedUser.id });

    await expect(getUserFollowingService({ userId: bannedTarget.id })).resolves.toMatchObject({
      users: [expect.objectContaining({ id: followedUser.id })],
    });
  });
});

async function createUsers(count: number) {
  return await Promise.all(Array.from({ length: count }, () => createTestUser(testDb)));
}

async function getStoredFollows(followerId: string, followingId: string) {
  return await testDb
    .select()
    .from(userFollows)
    .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)));
}
