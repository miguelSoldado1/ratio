import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { createSpotifyApi, getClientCredentialsToken } from "../spotify";

const searchAlbumsSchema = z.object({
  query: z.string().trim().min(1).max(100),
});

async function searchAlbumsHandler({ query }: z.infer<typeof searchAlbumsSchema>) {
  try {
    const accessToken = await getClientCredentialsToken();
    const spotifyApi = createSpotifyApi(accessToken);
    const { body } = await spotifyApi.searchAlbums(query, { limit: 10, market: "US" });

    return body.albums?.items.map(mapSpotifyAlbumSearch) ?? [];
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

function mapSpotifyAlbumSearch(album: SpotifyApi.AlbumObjectSimplified) {
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
