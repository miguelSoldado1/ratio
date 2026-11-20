import { cleanTestDatabase, closeTestDatabase, migrateTestDatabase, testDb } from "@test/db";
import { createTestList, createTestUser } from "@test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteOrphanedImages } from "@/server/services/image-cleanup-service";

const now = new Date("2026-11-20T12:00:00.000Z");
const twoDaysAgo = new Date("2026-11-18T12:00:00.000Z");
const oneHourAgo = new Date("2026-11-20T11:00:00.000Z");

beforeAll(async () => {
  await migrateTestDatabase();
});

beforeEach(async () => {
  await cleanTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe("deleteOrphanedImages", () => {
  it("deletes old images nothing references and keeps referenced or recent ones", async () => {
    const owner = await createTestUser(testDb, { avatarObjectKey: "avatars/u1/live.png" });
    await createTestList(testDb, { coverObjectKey: "list-covers/l1/live.png", userId: owner.id });
    const bucket = createFakeBucket(
      {
        "avatars/deleted-user/old.png": twoDaysAgo,
        "avatars/u1/live.png": twoDaysAgo,
        "avatars/u1/just-uploaded.png": oneHourAgo,
        "list-covers/deleted-list/old.png": twoDaysAgo,
        "list-covers/l1/live.png": twoDaysAgo,
        "unrelated/old.png": twoDaysAgo,
      },
      1000
    );

    const result = await deleteOrphanedImages({ bucket: bucket.binding, db: testDb, now });

    expect(result).toEqual({ deletedCount: 2 });
    expect(bucket.keys()).toEqual([
      "avatars/u1/just-uploaded.png",
      "avatars/u1/live.png",
      "list-covers/l1/live.png",
      "unrelated/old.png",
    ]);
  });

  it("follows truncated listings to later pages", async () => {
    const bucket = createFakeBucket(
      {
        "list-covers/a/old.png": twoDaysAgo,
        "list-covers/b/old.png": twoDaysAgo,
        "list-covers/c/old.png": twoDaysAgo,
      },
      1
    );

    const result = await deleteOrphanedImages({ bucket: bucket.binding, db: testDb, now });

    expect(result).toEqual({ deletedCount: 3 });
    expect(bucket.keys()).toEqual([]);
  });
});

function createFakeBucket(objects: Record<string, Date>, pageSize: number) {
  const stored = new Map(Object.entries(objects));

  const binding = {
    delete: (keys: string[]) => {
      for (const key of keys) stored.delete(key);
      return Promise.resolve();
    },
    list: ({ cursor, prefix }: { cursor?: string; prefix: string }) => {
      const matching = [...stored.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? matching.findIndex((key) => key > cursor) : 0;
      const page = start === -1 ? [] : matching.slice(start, start + pageSize);
      const truncated = start !== -1 && start + pageSize < matching.length;

      return Promise.resolve({
        cursor: truncated ? page.at(-1) : undefined,
        objects: page.map((key) => ({ key, uploaded: stored.get(key) })),
        truncated,
      });
    },
  };

  return { binding: binding as unknown as R2Bucket, keys: () => [...stored.keys()].sort() };
}
