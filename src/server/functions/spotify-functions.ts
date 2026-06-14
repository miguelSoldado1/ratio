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
    throw new Error("Failed to search albums", { cause: error });
  }
}

export const searchAlbums = createServerFn()
  .validator(searchAlbumsSchema)
  .handler(({ data }) => searchAlbumsHandler(data));

// --- Helpers ---

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
