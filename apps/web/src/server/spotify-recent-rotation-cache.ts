import { deleteSpotifyCacheJson } from "./spotify-cache";

const SPOTIFY_PROVIDER_ID = "spotify";
const SPOTIFY_RECENT_ROTATION_CACHE_KEY_PREFIX = "spotify:recent-rotation";

interface DeletedAccount {
  providerId: string;
  userId: string;
}

export function getSpotifyRecentRotationCacheKey(userId: string) {
  return `${SPOTIFY_RECENT_ROTATION_CACHE_KEY_PREFIX}:${userId}`;
}

export async function clearSpotifyRecentRotationCacheForDeletedAccount({ providerId, userId }: DeletedAccount) {
  if (providerId !== SPOTIFY_PROVIDER_ID) return;

  await deleteSpotifyCacheJson(getSpotifyRecentRotationCacheKey(userId));
}
