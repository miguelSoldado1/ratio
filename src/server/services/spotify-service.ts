import { createSpotifyApi, getClientCredentialsToken } from "../spotify";

// Spotify API types

type SpotifyAlbum = SpotifyApi.AlbumObjectSimplified;
type SpotifyAlbumDetails = SpotifyApi.SingleAlbumResponse;
type SpotifyAlbumTracks = SpotifyApi.AlbumTracksResponse;
type SpotifyAlbumTrack = SpotifyAlbumDetails["tracks"]["items"][number];
type SpotifyApiClient = ReturnType<typeof createSpotifyApi>;

export interface SpotifyAlbumPersistenceMetadata {
  artistNames: string[];
  coverUrl: string | null;
  id: string;
  releaseYear: number;
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

// Services

export async function searchAlbumsService({ query }: SearchAlbumsInput) {
  try {
    const accessToken = await getClientCredentialsToken();
    const spotifyApi = createSpotifyApi(accessToken);
    const { body } = await spotifyApi.searchAlbums(query, { limit: ALBUM_SEARCH_LIMIT, market: SPOTIFY_MARKET });

    const albums = getAlbumSearchResults(body.albums?.items ?? []);
    return albums.map(mapSpotifyAlbumSearch);
  } catch (error) {
    const status = isSpotifyError(error) ? error.statusCode : 500;
    throw new Error(spotifyErrorMessage(status, "Spotify search failed"));
  }
}

export async function getAlbumDetailsService({ albumId }: AlbumDetailsInput) {
  const { album, spotifyApi } = await getSpotifyAlbum(albumId);
  assertAlbumType(album);

  const tracks = await getAlbumTracks(spotifyApi, albumId, album.tracks);

  return mapSpotifyAlbumDetails(album, tracks);
}

export async function getAlbumPersistenceMetadata(albumId: string): Promise<SpotifyAlbumPersistenceMetadata> {
  const { album } = await getSpotifyAlbum(albumId);
  assertAlbumType(album);

  return mapSpotifyAlbumPersistenceMetadata(album);
}

async function getSpotifyAlbum(albumId: string) {
  try {
    const accessToken = await getClientCredentialsToken();
    const spotifyApi = createSpotifyApi(accessToken);
    const { body: album } = await spotifyApi.getAlbum(albumId, { market: SPOTIFY_MARKET });

    return { album, spotifyApi };
  } catch (error) {
    const status = isSpotifyError(error) ? error.statusCode : 500;
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

function isSpotifyError(error: unknown): error is { statusCode: number; message: string } {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return false;
  return typeof error.statusCode === "number";
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
    releaseYear: getSpotifyReleaseYear(album),
    title: album.name,
    totalTracks: album.total_tracks,
  };
}

function getSpotifyReleaseYear(album: SpotifyAlbumDetails) {
  const releaseYear = Number(album.release_date.slice(0, 4));

  if (!Number.isInteger(releaseYear)) {
    throw new Error("Spotify album release year is invalid");
  }

  return releaseYear;
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
    const { body } = await spotifyApi.getAlbumTracks(albumId, {
      limit: ALBUM_TRACKS_LIMIT,
      market: SPOTIFY_MARKET,
      offset: tracks.length,
    });

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

    const key = [
      album.name.trim().toLowerCase(),
      album.artists.map((artist) => artist.name.trim().toLowerCase()).join("|"),
      album.release_date.slice(0, 4),
    ].join("::");

    const currentAlbum = albumsByKey.get(key);
    if (!currentAlbum || album.id.localeCompare(currentAlbum.id) < 0) {
      albumsByKey.set(key, album);
    }
  }

  return Array.from(albumsByKey.values());
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
