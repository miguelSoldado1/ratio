import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import { createAuthenticatedContext, createTestUser } from "@test/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "@/lib/db/schema";
import { getAvatarPublicUrl, isUserAvatarObjectKey } from "@/server/avatar-storage";
import { removeMyAvatarService, setMyAvatarService } from "@/server/services/avatar-service";

vi.mock("@/env", () => ({
  env: {
    CLOUDFLARE_ACCESS_KEY_ID: "access-key",
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_R2_BUCKET_NAME: "bucket",
    CLOUDFLARE_R2_PUBLIC_URL: "https://assets.example.com///",
    CLOUDFLARE_SECRET_ACCESS_KEY: "secret",
  },
}));

const mockDeleteAvatarObject = vi.hoisted(() => vi.fn<() => Promise<void>>());

vi.mock("@better-upload/server/helpers", () => ({
  deleteObject: mockDeleteAvatarObject,
}));

vi.mock("@better-upload/server/clients", () => ({
  cloudflare: vi.fn(() => ({ client: "r2" })),
}));

beforeAll(async () => {
  await migrateTestDatabase();
});

beforeEach(async () => {
  mockDeleteAvatarObject.mockReset();
  mockDeleteAvatarObject.mockResolvedValue(undefined);
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("avatar storage helpers", () => {
  it("validates object key format and ownership", () => {
    const userId = "user_123";
    const objectKey = `avatars/${userId}/123e4567-e89b-12d3-a456-426614174000.webp`;

    expect(isUserAvatarObjectKey(objectKey, userId)).toBe(true);
    expect(isUserAvatarObjectKey(objectKey, "other_user")).toBe(false);
    expect(isUserAvatarObjectKey(`avatars/${userId}/not-a-uuid.webp`, userId)).toBe(false);
  });

  it("trims trailing slashes from public URL base", () => {
    expect(getAvatarPublicUrl("avatars/user_123/avatar.webp")).toBe(
      "https://assets.example.com/avatars/user_123/avatar.webp"
    );
  });
});

describe("setMyAvatarService", () => {
  it("rejects object keys not owned by the current user", async () => {
    const currentUser = await createTestUser(testDb);
    const context = createAuthenticatedContext(testDb, currentUser);

    await expect(
      setMyAvatarService({ objectKey: "avatars/other_user/123e4567-e89b-12d3-a456-426614174000.webp" }, context)
    ).rejects.toThrow("Avatar object not found");
    expect(mockDeleteAvatarObject).not.toHaveBeenCalled();
  });

  it("updates user avatar URL and object key for an owned object key", async () => {
    const currentUser = await createTestUser(testDb);
    const objectKey = avatarKey(currentUser.id);
    const context = createAuthenticatedContext(testDb, currentUser);

    await expect(setMyAvatarService({ objectKey }, context)).resolves.toEqual({
      avatarObjectKey: objectKey,
      avatarUrl: `https://assets.example.com/${objectKey}`,
      cleanupFailed: false,
    });

    const [storedUser] = await testDb
      .select({ avatarObjectKey: user.avatarObjectKey, image: user.image })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    expect(storedUser).toEqual({
      avatarObjectKey: objectKey,
      image: `https://assets.example.com/${objectKey}`,
    });
  });

  it("deletes the previous avatar object after successful update", async () => {
    const previousObjectKey = "avatars/test_user_previous/123e4567-e89b-12d3-a456-426614174000.webp";
    const currentUser = await createTestUser(testDb, {
      avatarObjectKey: previousObjectKey,
      image: `https://assets.example.com/${previousObjectKey}`,
      id: "test_user_previous",
    });
    const objectKey = avatarKey(currentUser.id, "223e4567-e89b-12d3-a456-426614174000.webp");
    const context = createAuthenticatedContext(testDb, currentUser);

    await expect(setMyAvatarService({ objectKey }, context)).resolves.toMatchObject({ cleanupFailed: false });

    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ key: previousObjectKey })
    );
  });

  it("cleans up new object when the user row is missing", async () => {
    const currentUser = { id: "missing_user" };
    const objectKey = avatarKey(currentUser.id);
    const context = createAuthenticatedContext(testDb, currentUser);

    await expect(setMyAvatarService({ objectKey }, context)).rejects.toThrow("User not found");

    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ key: objectKey }));
  });
});

describe("removeMyAvatarService", () => {
  it("clears DB avatar fields", async () => {
    const objectKey = "avatars/test_user_remove/123e4567-e89b-12d3-a456-426614174000.webp";
    const currentUser = await createTestUser(testDb, {
      avatarObjectKey: objectKey,
      id: "test_user_remove",
      image: `https://assets.example.com/${objectKey}`,
    });

    await expect(removeMyAvatarService(createAuthenticatedContext(testDb, currentUser))).resolves.toEqual({
      avatarObjectKey: undefined,
      avatarUrl: undefined,
      cleanupFailed: false,
    });

    const [storedUser] = await testDb
      .select({ avatarObjectKey: user.avatarObjectKey, image: user.image })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    expect(storedUser).toEqual({ avatarObjectKey: null, image: null });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ key: objectKey }));
  });

  it("removing an absent avatar is harmless", async () => {
    const currentUser = await createTestUser(testDb);

    await expect(removeMyAvatarService(createAuthenticatedContext(testDb, currentUser))).resolves.toEqual({
      avatarObjectKey: undefined,
      avatarUrl: undefined,
      cleanupFailed: false,
    });
    expect(mockDeleteAvatarObject).not.toHaveBeenCalled();
  });

  it("reports cleanup failure", async () => {
    const objectKey = "avatars/test_user_cleanup/123e4567-e89b-12d3-a456-426614174000.webp";
    const currentUser = await createTestUser(testDb, {
      avatarObjectKey: objectKey,
      id: "test_user_cleanup",
      image: `https://assets.example.com/${objectKey}`,
    });
    mockDeleteAvatarObject.mockRejectedValue(new Error("delete failed"));

    await expect(removeMyAvatarService(createAuthenticatedContext(testDb, currentUser))).resolves.toEqual({
      avatarObjectKey: undefined,
      avatarUrl: undefined,
      cleanupFailed: true,
    });
  });
});

function avatarKey(userId: string, objectName = "123e4567-e89b-12d3-a456-426614174000.webp") {
  return `avatars/${userId}/${objectName}`;
}
