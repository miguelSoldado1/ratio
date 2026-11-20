import { inArray } from "drizzle-orm";
import { lists, user } from "@/lib/db/schema";
import { imageCachePurgeLimit, purgeImageCache } from "../image-storage";
import type { Db } from "@/lib/db";

export const imageCleanupCron = "0 5 * * 1";

// Leaves time for an upload to be saved by its dialog before it counts as an orphan.
const orphanGracePeriodMs = 24 * 60 * 60 * 1000;
// Keeps one run within the free plan's CPU limit.
const maxPagesPerPrefix = 5;

interface ImagePrefix {
  getReferencedKeys: (db: Db, objectKeys: string[]) => Promise<(string | null)[]>;
  prefix: string;
}

interface DeleteOrphanedImagesParams {
  bucket: R2Bucket;
  db: Db;
  now: Date;
}

const imagePrefixes: ImagePrefix[] = [
  {
    getReferencedKeys: async (db, objectKeys) =>
      (
        await db.select({ objectKey: user.avatarObjectKey }).from(user).where(inArray(user.avatarObjectKey, objectKeys))
      ).map((row) => row.objectKey),
    prefix: "avatars/",
  },
  {
    getReferencedKeys: async (db, objectKeys) =>
      (
        await db
          .select({ objectKey: lists.coverObjectKey })
          .from(lists)
          .where(inArray(lists.coverObjectKey, objectKeys))
      ).map((row) => row.objectKey),
    prefix: "list-covers/",
  },
];

export async function deleteOrphanedImages({ bucket, db, now }: DeleteOrphanedImagesParams) {
  let deletedCount = 0;

  for (const { getReferencedKeys, prefix } of imagePrefixes) {
    let cursor: string | undefined;

    for (let page = 0; page < maxPagesPerPrefix; page++) {
      const listed = await bucket.list({ cursor, prefix });
      const candidateKeys = listed.objects
        .filter((object) => now.getTime() - object.uploaded.getTime() > orphanGracePeriodMs)
        .map((object) => object.key);

      if (candidateKeys.length > 0) {
        const referencedKeys = new Set(await getReferencedKeys(db, candidateKeys));
        // One purge request per page keeps a run within the free plan's subrequest limit.
        const orphanKeys = candidateKeys
          .filter((objectKey) => !referencedKeys.has(objectKey))
          .slice(0, imageCachePurgeLimit);

        if (orphanKeys.length > 0) {
          await bucket.delete(orphanKeys);
          await purgeImageCache(orphanKeys);
          deletedCount += orphanKeys.length;
        }
      }

      if (!listed.truncated) break;
      cursor = listed.cursor;
    }
  }

  return { deletedCount };
}
