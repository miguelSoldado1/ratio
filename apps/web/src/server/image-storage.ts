import { cloudflare } from "@better-upload/server/clients";
import { deleteObject, deleteObjects } from "@better-upload/server/helpers";
import { env } from "@/env";
import { getImageUploadFileExtension } from "@/lib/image-upload";

const avatarObjectPrefix = "avatars";
const listCoverObjectPrefix = "list-covers";
const imageObjectNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:avif|jpg|png|webp)$/i;
const trailingSlashesPattern = /\/+$/;

export const imageCachePurgeLimit = 100;
const imageBatchDeleteLimit = 1000;
const maxPurgeRetryDelaySeconds = 5;

export function createR2Client() {
  return cloudflare({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
  });
}

export function createAvatarObjectKey({ fileType, userId }: { fileType: string; userId: string }) {
  return `${avatarObjectPrefix}/${userId}/${createImageObjectName(fileType)}`;
}

export function createListCoverObjectKey({ fileType, listId }: { fileType: string; listId: string }) {
  return `${listCoverObjectPrefix}/${listId}/${createImageObjectName(fileType)}`;
}

export function isUserAvatarObjectKey(objectKey: string, userId: string) {
  return isImageObjectKeyIn(objectKey, `${avatarObjectPrefix}/${userId}/`);
}

export function isListCoverObjectKey(objectKey: string, listId: string) {
  return isImageObjectKeyIn(objectKey, `${listCoverObjectPrefix}/${listId}/`);
}

export function getImagePublicUrl(objectKey: string) {
  const baseUrl = env.CLOUDFLARE_R2_PUBLIC_URL.replace(trailingSlashesPattern, "");

  return `${baseUrl}/${objectKey}`;
}

export async function deleteImageObject(objectKey: string) {
  await deleteImageObjectFromBucket(objectKey);
  await purgeImageCache([objectKey]);
}

// Batched deletes and purges keep deleting a whole account within the Worker's subrequest limit.
export async function deleteImageObjects(objectKeys: string[]) {
  const failedKeys: string[] = [];

  for (let start = 0; start < objectKeys.length; start += imageBatchDeleteLimit) {
    const { deleted, errors } = await deleteObjects(createR2Client(), {
      bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      objects: objectKeys.slice(start, start + imageBatchDeleteLimit).map((key) => ({ key })),
      quiet: false,
    });
    const deletedKeys = deleted.map((object) => object.key);
    failedKeys.push(...errors.map((error) => error.key));

    for (let purgeStart = 0; purgeStart < deletedKeys.length; purgeStart += imageCachePurgeLimit) {
      await purgeImageCache(deletedKeys.slice(purgeStart, purgeStart + imageCachePurgeLimit));
    }
  }

  return { failedKeys };
}

// Images are served as immutable for a year, so a deleted one stays in Cloudflare's edge cache until purged.
export async function purgeImageCache(objectKeys: string[]) {
  try {
    let response = await requestImageCachePurge(objectKeys);

    // A lost purge leaves a deleted image public, so ride out one rate limit before giving up.
    if (response.status === 429) {
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, getRetryAfterMs(response)));
      response = await requestImageCachePurge(objectKeys);
    }

    if (!response.ok) throw new Error(`Cache purge failed with status ${response.status}`);
  } catch (error) {
    console.error("image_cache_purge_failed", { error, objectKeys });
  }
}

export async function deleteImageObjectSafely(objectKey: string) {
  try {
    await deleteImageObject(objectKey);
    return true;
  } catch {
    return false;
  }
}

function createImageObjectName(fileType: string) {
  const extension = getImageUploadFileExtension(fileType);

  if (!extension) {
    throw new Error("Unsupported image file type");
  }

  return `${crypto.randomUUID()}.${extension}`;
}

function isImageObjectKeyIn(objectKey: string, prefix: string) {
  return objectKey.startsWith(prefix) && imageObjectNamePattern.test(objectKey.slice(prefix.length));
}

function requestImageCachePurge(objectKeys: string[]) {
  return fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
    body: JSON.stringify({ files: objectKeys.map(getImagePublicUrl) }),
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_CACHE_PURGE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function deleteImageObjectFromBucket(objectKey: string) {
  await deleteObject(createR2Client(), {
    bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    key: objectKey,
  });
}

function getRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);

  return Number.isFinite(retryAfterSeconds) ? Math.min(retryAfterSeconds, maxPurgeRetryDelaySeconds) * 1000 : 1000;
}
