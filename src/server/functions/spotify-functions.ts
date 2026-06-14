import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { createSpotifyApi, getClientCredentialsToken } from "../spotify";

type SpotifyAlbum = SpotifyApi.AlbumObjectSimplified;

const searchAlbumsSchema = z.object({
  query: z.string().trim().min(1).max(100),
});
const ALBUM_SEARCH_LIMIT = 10;
const SPOTIFY_MARKET = "US";
const ALBUM_TYPE = "album" satisfies SpotifyAlbum["album_type"];

async function searchAlbumsHandler({ query }: z.infer<typeof searchAlbumsSchema>) {
  try {
    const accessToken = await getClientCredentialsToken();
    const spotifyApi = createSpotifyApi(accessToken);
    const { body } = await spotifyApi.searchAlbums(query, { limit: ALBUM_SEARCH_LIMIT, market: SPOTIFY_MARKET });

    const albums = getAlbumSearchResults(body.albums?.items ?? []);
    return albums.map(mapSpotifyAlbumSearch);
  } catch (error) {
    const status = isSpotifyError(error) ? error.statusCode : 500;
    throw new Error(spotifyErrorMessage(status));
  }
}

export const searchAlbums = createServerFn()
  .validator(searchAlbumsSchema)
  .handler(({ data }) => searchAlbumsHandler(data));

// --- Helpers ---

function spotifyErrorMessage(status: number): string {
  if (status === 429) return "Spotify rate limit reached, try again shortly";
  if (status === 401) return "Spotify authentication failed";
  return "Spotify search failed";
}

function isSpotifyError(error: unknown): error is { statusCode: number; message: string } {
  if (typeof error !== "object" || error === null) return false;
  return "statusCode" in error && typeof (error as { statusCode: unknown }).statusCode === "number";
}

function mapSpotifyAlbumSearch(album: SpotifyAlbum) {
  return {
    id: album.id,
    name: album.name,
    releaseDate: album.release_date,
    albumType: album.album_type,
    spotifyUrl: album.external_urls.spotify,
    artists: album.artists.map((artist) => ({ id: artist.id, name: artist.name })),
    image: getSmallestImageUrl(album.images),
  };
}

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
