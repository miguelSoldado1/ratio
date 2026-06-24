import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import { deleteAvatarObject, getAvatarPublicUrl, isUserAvatarObjectKey } from "../avatar-storage";
import type { AuthenticatedContext } from "../auth-middleware";

export interface SetAvatarInput {
  objectKey: string;
}

export interface AvatarMutationResult {
  avatarObjectKey: string | undefined;
  avatarUrl: string | undefined;
  cleanupFailed: boolean;
}

export async function setMyAvatarService(data: SetAvatarInput, context: AuthenticatedContext) {
  if (!isUserAvatarObjectKey(data.objectKey, context.user.id)) {
    throw new Error("Avatar object not found");
  }

  const [currentUser] = await context.db
    .select({ avatarObjectKey: user.avatarObjectKey })
    .from(user)
    .where(eq(user.id, context.user.id))
    .limit(1);

  if (!currentUser) {
    await deleteAvatarObjectSafely(data.objectKey);
    throw new Error("User not found");
  }

  const avatarUrl = getAvatarPublicUrl(data.objectKey);

  try {
    await context.db
      .update(user)
      .set({ avatarObjectKey: data.objectKey, image: avatarUrl })
      .where(eq(user.id, context.user.id));
  } catch (error) {
    await deleteAvatarObjectSafely(data.objectKey);
    throw error;
  }

  const cleanupFailed =
    currentUser.avatarObjectKey && currentUser.avatarObjectKey !== data.objectKey
      ? !(await deleteAvatarObjectSafely(currentUser.avatarObjectKey))
      : false;

  return {
    avatarObjectKey: data.objectKey,
    avatarUrl,
    cleanupFailed,
  } satisfies AvatarMutationResult;
}

export async function removeMyAvatarService(context: AuthenticatedContext) {
  const [currentUser] = await context.db
    .select({ avatarObjectKey: user.avatarObjectKey, avatarUrl: user.image })
    .from(user)
    .where(eq(user.id, context.user.id))
    .limit(1);

  if (!(currentUser?.avatarObjectKey || currentUser?.avatarUrl)) {
    return { avatarObjectKey: undefined, avatarUrl: undefined, cleanupFailed: false } satisfies AvatarMutationResult;
  }

  await context.db.update(user).set({ avatarObjectKey: null, image: null }).where(eq(user.id, context.user.id));

  const cleanupFailed = currentUser.avatarObjectKey
    ? !(await deleteAvatarObjectSafely(currentUser.avatarObjectKey))
    : false;

  return { avatarObjectKey: undefined, avatarUrl: undefined, cleanupFailed } satisfies AvatarMutationResult;
}

async function deleteAvatarObjectSafely(objectKey: string) {
  try {
    await deleteAvatarObject(objectKey);
    return true;
  } catch {
    return false;
  }
}
