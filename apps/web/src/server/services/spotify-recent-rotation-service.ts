import z from "zod";
import { createSpotifyApi } from "../spotify";
import { getSpotifyErrorStatus, logSpotifyApiError } from "../spotify-observability";
import { getSpotifyRecentRotationCacheKey } from "../spotify-recent-rotation-cache";
import {
  getSpotifyUserAccessToken,
  SpotifyAuthorizationRequiredError,
  SpotifyReconnectRequiredError,
} from "../spotify-user-token";
import { getLargestImageUrl, getSpotifyCacheValueOrFetch } from "./spotify-service";
import type { Db } from "@/lib/db";
import type { AuthenticatedContext } from "../auth-middleware";

// Spotify API types

type SpotifyPlayHistoryItem = SpotifyApi.PlayHistoryObject;

// Types

export interface RecentRotationAlbum {
  artistNames: string[];
  coverUrl: string | null;
  id: string;
  lastPlayedAt: string;
  releaseYear: string | null;
  spotifyUrl: string;
  title: string;
}

export interface RecentRotationResponse {
  albums: RecentRotationAlbum[];
  refreshedAt: string;
}

export type RecentRotationResult =
  | ({ status: "ready" } & RecentRotationResponse)
  | {
      status: "authorization-required" | "rate-limited" | "reconnect-required" | "unavailable";
    };

// Constants

const RECENT_ROTATION_ALBUM_LIMIT = 6;
const RECENTLY_PLAYED_TRACKS_LIMIT = 50;
const ALBUM_TYPE = "album";

const SPOTIFY_RECENT_ROTATION_CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

// Cache schemas

const recentRotationAlbumSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistNames: z.array(z.string()),
  coverUrl: z.string().nullable(),
  releaseYear: z.string().nullable(),
  spotifyUrl: z.string(),
  lastPlayedAt: z.string(),
});

const recentRotationResponseSchema = z.object({
  albums: z.array(recentRotationAlbumSchema),
  refreshedAt: z.string(),
});

// Services

export async function getMyRecentRotationService({ db, user }: AuthenticatedContext): Promise<RecentRotationResult> {
  const tokenResult = await getRotationUserAccessToken(db, user.id);
  if (tokenResult.status !== "ready") return tokenResult;

  async function fetchRecentRotationFromSpotify() {
    const spotifyApi = createSpotifyApi(tokenResult.accessToken);
    const { body } = await spotifyApi.getMyRecentlyPlayedTracks({ limit: RECENTLY_PLAYED_TRACKS_LIMIT });

    return {
      albums: mapRecentlyPlayedToRotationAlbums(body.items ?? []),
      refreshedAt: new Date().toISOString(),
    };
  }

  try {
    const rotation = await getSpotifyCacheValueOrFetch({
      cacheKey: getSpotifyRecentRotationCacheKey(user.id),
      ttlSeconds: SPOTIFY_RECENT_ROTATION_CACHE_TTL_SECONDS,
      schema: recentRotationResponseSchema,
      fetcher: fetchRecentRotationFromSpotify,
    });

    return { status: "ready", ...rotation };
  } catch (error) {
    const status = getSpotifyErrorStatus(error);

    if (status === 401 || status === 403) return { status: "reconnect-required" };

    logSpotifyApiError("recent_rotation", error, { status });

    return { status: status === 429 ? "rate-limited" : "unavailable" };
  }
}

// Token status

async function getRotationUserAccessToken(db: Db, userId: string) {
  try {
    return {
      accessToken: await getSpotifyUserAccessToken(db, userId),
      status: "ready" as const,
    };
  } catch (error) {
    if (error instanceof SpotifyAuthorizationRequiredError) return { status: "authorization-required" as const };
    if (error instanceof SpotifyReconnectRequiredError) return { status: "reconnect-required" as const };

    throw error;
  }
}

// Mappers

export function mapRecentlyPlayedToRotationAlbums(items: SpotifyPlayHistoryItem[]) {
  const albumsById = new Map<string, RecentRotationAlbum>();

  for (const item of items) {
    const album = item?.track?.album;
    const playedAt = getValidPlayedAt(item?.played_at);

    // Local tracks and malformed entries have no Spotify album ID; skip them.
    if (!(album?.id && playedAt)) continue;
    if (album.album_type !== ALBUM_TYPE) continue;

    const existingAlbum = albumsById.get(album.id);

    if (existingAlbum) {
      if (Date.parse(playedAt) > Date.parse(existingAlbum.lastPlayedAt)) {
        existingAlbum.lastPlayedAt = playedAt;
      }
      continue;
    }

    albumsById.set(album.id, {
      id: album.id,
      title: album.name,
      artistNames: (album.artists ?? []).map((artist) => artist.name),
      coverUrl: getLargestImageUrl(album.images ?? []),
      releaseYear: getReleaseYear(album.release_date),
      spotifyUrl: `https://open.spotify.com/album/${album.id}`,
      lastPlayedAt: playedAt,
    });
  }

  return Array.from(albumsById.values())
    .sort((albumA, albumB) => Date.parse(albumB.lastPlayedAt) - Date.parse(albumA.lastPlayedAt))
    .slice(0, RECENT_ROTATION_ALBUM_LIMIT);
}

function getValidPlayedAt(playedAt: string | undefined) {
  if (!playedAt || Number.isNaN(Date.parse(playedAt))) return null;

  return playedAt;
}

const RELEASE_YEAR_PATTERN = /^\d{4}/;

function getReleaseYear(releaseDate: string | undefined) {
  if (!(releaseDate && RELEASE_YEAR_PATTERN.test(releaseDate))) return null;

  return releaseDate.slice(0, 4);
}
