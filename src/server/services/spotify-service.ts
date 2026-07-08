import z from "zod";
import { createSpotifyApi, getClientCredentialsToken } from "../spotify";
import { getSpotifyCacheJson, setSpotifyCacheJson } from "../spotify-cache";
import {
  getSpotifyErrorStatus,
  logSpotifyApiError,
  logSpotifyInvalidCache,
  SpotifyTokenError,
} from "../spotify-observability";

// Spotify API types

type SpotifyAlbum = SpotifyApi.AlbumObjectSimplified;
type SpotifyAlbumDetails = SpotifyApi.SingleAlbumResponse;
type SpotifyAlbumTracks = SpotifyApi.AlbumTracksResponse;
type SpotifyAlbumTrack = SpotifyAlbumDetails["tracks"]["items"][number];
type SpotifyApiClient = ReturnType<typeof createSpotifyApi>;

// Types

export interface SpotifyAlbumPersistenceMetadata {
  artistNames: string[];
  coverUrl: string | null;
  id: string;
  releaseDate: string;
  title: string;
  totalTracks: number;
}

export interface SearchAlbumsInput {
  query: string;
}

export interface AlbumDetailsInput {
  albumId: string;
}

// Constants

const ALBUM_SEARCH_LIMIT = 10;
const ALBUM_TRACKS_LIMIT = 50;
const SPOTIFY_MARKET = "US";
const ALBUM_TYPE = "album" satisfies SpotifyAlbum["album_type"];
const ALBUMS_ONLY_ERROR_MESSAGE = "Only albums are supported";

const SPOTIFY_CACHE_KEY_PREFIX = "spotify";

const SPOTIFY_SEARCH_CACHE_KEY_PREFIX = `${SPOTIFY_CACHE_KEY_PREFIX}:search:album`;
const SPOTIFY_SEARCH_CACHE_TTL_SECONDS = 10 * 60; // 10 minutes

const SPOTIFY_ALBUM_DETAILS_CACHE_KEY_PREFIX = `${SPOTIFY_CACHE_KEY_PREFIX}:album-details`;
const SPOTIFY_ALBUM_DETAILS_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

const SPOTIFY_ALBUM_PERSISTENCE_CACHE_KEY_PREFIX = `${SPOTIFY_CACHE_KEY_PREFIX}:album-persistence`;
const SPOTIFY_ALBUM_PERSISTENCE_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const SPOTIFY_RELEASE_YEAR_DATE_PATTERN = /^\d{4}$/;
const SPOTIFY_RELEASE_MONTH_DATE_PATTERN = /^\d{4}-\d{2}$/;
const SPOTIFY_RELEASE_DAY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const inFlightSpotifyCacheRequests = new Map<string, Promise<unknown>>();

// Cache schemas

const spotifyAlbumSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  releaseDate: z.string(),
  albumType: z.literal(ALBUM_TYPE),
  spotifyUrl: z.string(),
  artists: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    })
  ),
  image: z.string().nullable(),
});

const spotifyArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  spotifyUrl: z.string(),
});

const spotifyAlbumTrackSchema = z.object({
  id: z.string(),
  discNumber: z.number(),
  durationMs: z.number(),
  previewUrl: z.string().nullable(),
  spotifyUrl: z.string(),
  title: z.string(),
  trackNumber: z.number(),
});

const spotifyAlbumDetailsResultSchema = z.object({
  album: z.object({
    albumType: z.string(),
    artists: z.array(spotifyArtistSchema),
    coverUrl: z.string().nullable(),
    durationMs: z.number(),
    genre: z.string().nullable(),
    id: z.string(),
    label: z.string(),
    releaseDate: z.string(),
    spotifyUrl: z.string(),
    title: z.string(),
    totalTracks: z.number(),
  }),
  tracks: z.array(spotifyAlbumTrackSchema),
});

const spotifyAlbumPersistenceMetadataSchema = z.object({
  artistNames: z.array(z.string()),
  coverUrl: z.string().nullable(),
  id: z.string(),
  releaseDate: z.string(),
  title: z.string(),
  totalTracks: z.number(),
});

const spotifyAlbumSearchResultsSchema = z.array(spotifyAlbumSearchResultSchema);

// Services

export async function searchAlbumsService({ query }: SearchAlbumsInput) {
  try {
    const normalizedQuery = normalizeAlbumSearchText(query);
    const cacheKey = getSpotifySearchCacheKey(normalizedQuery);

    return await getSpotifyCacheValueOrFetch({
      cacheKey,
      schema: spotifyAlbumSearchResultsSchema,
      ttlSeconds: SPOTIFY_SEARCH_CACHE_TTL_SECONDS,
      fetcher: async () => {
        const accessToken = await getClientCredentialsToken();
        const spotifyApi = createSpotifyApi(accessToken);
        const { body } = await spotifyApi.searchAlbums(normalizedQuery, {
          limit: ALBUM_SEARCH_LIMIT,
          market: SPOTIFY_MARKET,
        });

        const albums = getAlbumSearchResults(body.albums?.items ?? []);
        return albums.map(mapSpotifyAlbumSearch);
      },
    });
  } catch (error) {
    const status = getSpotifyErrorStatus(error);

    if (!(error instanceof SpotifyTokenError)) {
      logSpotifyApiError("search", error, {
        queryLength: normalizeAlbumSearchText(query).length,
      });
    }

    throw new Error(spotifyErrorMessage(status, "Spotify search failed"));
  }
}

export async function getAlbumDetailsService({ albumId }: AlbumDetailsInput) {
  const cacheKey = getSpotifyAlbumDetailsCacheKey(albumId);

  return await getSpotifyCacheValueOrFetch({
    cacheKey,
    schema: spotifyAlbumDetailsResultSchema,
    ttlSeconds: SPOTIFY_ALBUM_DETAILS_CACHE_TTL_SECONDS,
    fetcher: async () => {
      const { album, spotifyApi } = await getSpotifyAlbum(albumId);
      assertAlbumType(album);

      const tracks = await getAlbumTracks(spotifyApi, albumId, album.tracks);

      return mapSpotifyAlbumDetails(album, tracks);
    },
  });
}

export async function getAlbumPersistenceMetadata(albumId: string): Promise<SpotifyAlbumPersistenceMetadata> {
  const cacheKey = getSpotifyAlbumPersistenceCacheKey(albumId);
  const cachedAlbumDetails = await getParsedSpotifyCacheValue(
    getSpotifyAlbumDetailsCacheKey(albumId),
    spotifyAlbumDetailsResultSchema
  );

  if (cachedAlbumDetails) {
    return mapCachedAlbumDetailsToPersistenceMetadata(cachedAlbumDetails);
  }

  return await getSpotifyCacheValueOrFetch({
    cacheKey,
    schema: spotifyAlbumPersistenceMetadataSchema,
    ttlSeconds: SPOTIFY_ALBUM_PERSISTENCE_CACHE_TTL_SECONDS,
    fetcher: async () => {
      const { album } = await getSpotifyAlbum(albumId);
      assertAlbumType(album);

      return mapSpotifyAlbumPersistenceMetadata(album);
    },
  });
}

// Helpers

async function getSpotifyCacheValueOrFetch<T>({
  cacheKey,
  fetcher,
  schema,
  ttlSeconds,
}: {
  cacheKey: string;
  fetcher: () => Promise<T>;
  schema: z.ZodType<T>;
  ttlSeconds: number;
}) {
  const cachedValue = await getParsedSpotifyCacheValue(cacheKey, schema);
  if (cachedValue) return cachedValue;

  return await dedupeInFlightSpotifyRequest(cacheKey, async () => {
    const cachedValueAfterWait = await getParsedSpotifyCacheValue(cacheKey, schema);
    if (cachedValueAfterWait) return cachedValueAfterWait;

    const value = await fetcher();
    await setSpotifyCacheJson(cacheKey, value, ttlSeconds);

    return value;
  });
}

async function getParsedSpotifyCacheValue<T>(cacheKey: string, schema: z.ZodType<T>) {
  const cachedValue = await getSpotifyCacheJson(cacheKey);
  if (cachedValue === null) return null;

  const parsedCachedValue = schema.safeParse(cachedValue);
  if (parsedCachedValue.success) return parsedCachedValue.data;

  logSpotifyInvalidCache("parse_response", parsedCachedValue.error);
  return null;
}

async function dedupeInFlightSpotifyRequest<T>(cacheKey: string, fetcher: () => Promise<T>) {
  const inFlightRequest = inFlightSpotifyCacheRequests.get(cacheKey) as Promise<T> | undefined;
  if (inFlightRequest) return await inFlightRequest;

  const request = fetcher().finally(() => inFlightSpotifyCacheRequests.delete(cacheKey));
  inFlightSpotifyCacheRequests.set(cacheKey, request);

  return await request;
}

async function getSpotifyAlbum(albumId: string) {
  try {
    const accessToken = await getClientCredentialsToken();
    const spotifyApi = createSpotifyApi(accessToken);
    const { body: album } = await spotifyApi.getAlbum(albumId, { market: SPOTIFY_MARKET });

    return { album, spotifyApi };
  } catch (error) {
    const status = getSpotifyErrorStatus(error);

    if (!(error instanceof SpotifyTokenError)) {
      logSpotifyApiError("album_lookup", error, { albumId });
    }

    throw new Error(spotifyErrorMessage(status, "Spotify album lookup failed"));
  }
}

// Errors

function spotifyErrorMessage(status: number, fallbackMessage: string): string {
  if (status === 429) return "Spotify rate limit reached, try again shortly";
  if (status === 401) return "Spotify authentication failed";
  if (status === 400) return "Invalid Spotify album ID";
  if (status === 404) return "Spotify album not found";
  return fallbackMessage;
}

function assertAlbumType(album: SpotifyAlbumDetails) {
  if (album.album_type !== ALBUM_TYPE) {
    throw new Error(ALBUMS_ONLY_ERROR_MESSAGE);
  }
}

// Mappers

function mapSpotifyAlbumSearch(album: SpotifyAlbum) {
  return {
    id: album.id,
    name: album.name,
    releaseDate: album.release_date,
    albumType: album.album_type,
    spotifyUrl: getSpotifyUrl("album", album.id),
    artists: album.artists.map((artist) => ({ id: artist.id, name: artist.name })),
    image: getSmallestImageUrl(album.images),
  };
}

function mapSpotifyAlbumDetails(album: SpotifyAlbumDetails, tracks: SpotifyAlbumTrack[]) {
  const mappedTracks = tracks.map(mapSpotifyAlbumTrack);
  const durationMs = mappedTracks.reduce((totalDurationMs, track) => totalDurationMs + track.durationMs, 0);
  const coverUrl = getLargestImageUrl(album.images);

  return {
    album: {
      albumType: album.album_type,
      artists: album.artists.map(mapSpotifyArtist),
      coverUrl,
      durationMs,
      genre: album.genres[0] ?? null,
      id: album.id,
      label: album.label,
      releaseDate: album.release_date,
      spotifyUrl: getSpotifyUrl("album", album.id),
      title: album.name,
      totalTracks: album.total_tracks,
    },
    tracks: mappedTracks,
  };
}

function mapSpotifyAlbumPersistenceMetadata(album: SpotifyAlbumDetails): SpotifyAlbumPersistenceMetadata {
  return {
    artistNames: album.artists.map((artist) => artist.name),
    coverUrl: getLargestImageUrl(album.images),
    id: album.id,
    releaseDate: getNormalizedSpotifyReleaseDate(album.release_date),
    title: album.name,
    totalTracks: album.total_tracks,
  };
}

function mapCachedAlbumDetailsToPersistenceMetadata({
  album,
}: z.infer<typeof spotifyAlbumDetailsResultSchema>): SpotifyAlbumPersistenceMetadata {
  return {
    artistNames: album.artists.map((artist) => artist.name),
    coverUrl: album.coverUrl,
    id: album.id,
    releaseDate: getNormalizedSpotifyReleaseDate(album.releaseDate),
    title: album.title,
    totalTracks: album.totalTracks,
  };
}

function getNormalizedSpotifyReleaseDate(releaseDate: string) {
  if (SPOTIFY_RELEASE_YEAR_DATE_PATTERN.test(releaseDate)) return `${releaseDate}-01-01`;
  if (SPOTIFY_RELEASE_MONTH_DATE_PATTERN.test(releaseDate)) return `${releaseDate}-01`;
  if (SPOTIFY_RELEASE_DAY_DATE_PATTERN.test(releaseDate)) return releaseDate;

  throw new Error("Spotify album release date is invalid");
}

function mapSpotifyAlbumTrack(track: SpotifyAlbumTrack) {
  return {
    id: track.id,
    discNumber: track.disc_number,
    durationMs: track.duration_ms,
    previewUrl: track.preview_url,
    spotifyUrl: getSpotifyUrl("track", track.id),
    title: track.name,
    trackNumber: track.track_number,
  };
}

function mapSpotifyArtist(artist: SpotifyApi.ArtistObjectSimplified) {
  return {
    id: artist.id,
    name: artist.name,
    spotifyUrl: getSpotifyUrl("artist", artist.id),
  };
}

function getSpotifyUrl(resourceType: "album" | "artist" | "track", id: string) {
  return `https://open.spotify.com/${resourceType}/${id}`;
}

// Pagination

async function getAlbumTracks(spotifyApi: SpotifyApiClient, albumId: string, tracksPage: SpotifyAlbumTracks) {
  const tracks = [...tracksPage.items];

  while (tracks.length < tracksPage.total) {
    const offset = tracks.length;
    let body: SpotifyAlbumTracks;

    try {
      ({ body } = await spotifyApi.getAlbumTracks(albumId, {
        limit: ALBUM_TRACKS_LIMIT,
        market: SPOTIFY_MARKET,
        offset,
      }));
    } catch (error) {
      logSpotifyApiError("album_tracks", error, { albumId, offset });
      throw error;
    }

    tracks.push(...body.items);

    if (body.items.length === 0) break;
  }

  return tracks;
}

// Search filtering

function getAlbumSearchResults(searchResults: SpotifyAlbum[]) {
  const albumsByKey = new Map<string, SpotifyAlbum>();

  for (const album of searchResults) {
    if (album.album_type !== ALBUM_TYPE) continue;

    const key = getAlbumSearchDedupeKey(album);
    if (!albumsByKey.has(key)) albumsByKey.set(key, album);
  }

  return Array.from(albumsByKey.values());
}

function getAlbumSearchDedupeKey(album: SpotifyAlbum) {
  return [
    normalizeAlbumSearchText(removeAdvisoryEditionMarkers(album.name)),
    album.artists.map((artist) => normalizeAlbumSearchText(artist.name)).join("|"),
    album.release_date.slice(0, 4),
    album.total_tracks,
  ].join("::");
}

function removeAdvisoryEditionMarkers(value: string) {
  return value.replace(/\s*[([{"']\s*(?:explicit|clean|edited|clean version|explicit version)\s*[)\]}"']\s*/gi, " ");
}

function normalizeAlbumSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Cache keys

function getSpotifySearchCacheKey(normalizedQuery: string) {
  return getSpotifyMarketCacheKey(SPOTIFY_SEARCH_CACHE_KEY_PREFIX, normalizedQuery);
}

function getSpotifyAlbumDetailsCacheKey(albumId: string) {
  return getSpotifyMarketCacheKey(SPOTIFY_ALBUM_DETAILS_CACHE_KEY_PREFIX, albumId);
}

function getSpotifyAlbumPersistenceCacheKey(albumId: string) {
  return getSpotifyMarketCacheKey(SPOTIFY_ALBUM_PERSISTENCE_CACHE_KEY_PREFIX, albumId);
}

function getSpotifyMarketCacheKey(prefix: string, value: string) {
  return `${prefix}:${SPOTIFY_MARKET.toLowerCase()}:${encodeURIComponent(value)}`;
}

// Images

function getSmallestImageUrl(images: SpotifyApi.ImageObject[]) {
  const [firstImage, ...remainingImages] = images;
  if (!firstImage) return null;

  let smallestImage = firstImage;

  for (const image of remainingImages) {
    const imageWidth = image.width ?? Number.POSITIVE_INFINITY;
    const smallestImageWidth = smallestImage.width ?? Number.POSITIVE_INFINITY;

    if (imageWidth < smallestImageWidth) {
      smallestImage = image;
    }
  }

  return smallestImage.url;
}

function getLargestImageUrl(images: SpotifyApi.ImageObject[]) {
  const [firstImage, ...remainingImages] = images;
  if (!firstImage) return null;

  let largestImage = firstImage;

  for (const image of remainingImages) {
    const imageWidth = image.width ?? 0;
    const largestImageWidth = largestImage.width ?? 0;

    if (imageWidth > largestImageWidth) {
      largestImage = image;
    }
  }

  return largestImage.url;
}
