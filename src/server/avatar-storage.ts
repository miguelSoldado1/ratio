import { cloudflare } from "@better-upload/server/clients";
import { deleteObject } from "@better-upload/server/helpers";
import { env } from "@/env";
import { getAvatarFileExtension } from "@/lib/avatar";

const avatarObjectPrefix = "avatars";
const avatarObjectNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:avif|jpg|png|webp)$/i;
const trailingSlashesPattern = /\/+$/;

export function createR2Client() {
  return cloudflare({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
  });
}

export function createAvatarObjectKey({ fileType, userId }: { fileType: string; userId: string }) {
  const extension = getAvatarFileExtension(fileType);

  if (!extension) {
    throw new Error("Unsupported avatar file type");
  }

  return `${avatarObjectPrefix}/${userId}/${crypto.randomUUID()}.${extension}`;
}

export function getAvatarPublicUrl(objectKey: string) {
  const baseUrl = env.CLOUDFLARE_R2_PUBLIC_URL.replace(trailingSlashesPattern, "");

  return `${baseUrl}/${objectKey}`;
}

export function isUserAvatarObjectKey(objectKey: string, userId: string) {
  const userAvatarPrefix = `${avatarObjectPrefix}/${userId}/`;

  return (
    objectKey.startsWith(userAvatarPrefix) && avatarObjectNamePattern.test(objectKey.slice(userAvatarPrefix.length))
  );
}

export async function deleteAvatarObject(objectKey: string) {
  await deleteObject(createR2Client(), {
    bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    key: objectKey,
  });
}
