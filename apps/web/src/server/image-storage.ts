import { cloudflare } from "@better-upload/server/clients";
import { deleteObject } from "@better-upload/server/helpers";
import { env } from "@/env";
import { getImageUploadFileExtension } from "@/lib/image-upload";

const avatarObjectPrefix = "avatars";
const listCoverObjectPrefix = "list-covers";
const imageObjectNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:avif|jpg|png|webp)$/i;
const trailingSlashesPattern = /\/+$/;

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
  await deleteObject(createR2Client(), {
    bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    key: objectKey,
  });
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
