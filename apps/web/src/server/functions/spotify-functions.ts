import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { createCloudflareRateLimitMiddleware, spotifyCatalogRateLimit } from "../rate-limit";
import * as spotifyService from "../services/spotify-service";
import { spotifyIdSchema } from "../spotify";

// Schemas

const searchAlbumsSchema = z.object({
  query: z.string().trim().min(2).max(100),
});

const albumDetailsSchema = z.object({
  albumId: spotifyIdSchema,
});

const artistAlbumsSchema = z.object({
  albumId: spotifyIdSchema,
  artistId: spotifyIdSchema,
});

// Server functions

export const searchAlbums = createServerFn()
  .middleware([createCloudflareRateLimitMiddleware(spotifyCatalogRateLimit)])
  .validator(searchAlbumsSchema)
  .handler(({ data }) => spotifyService.searchAlbumsService(data));

export const getAlbumDetails = createServerFn()
  .middleware([createCloudflareRateLimitMiddleware(spotifyCatalogRateLimit)])
  .validator(albumDetailsSchema)
  .handler(({ data }) => spotifyService.getAlbumDetailsService(data));

export const getArtistAlbums = createServerFn()
  .middleware([createCloudflareRateLimitMiddleware(spotifyCatalogRateLimit)])
  .validator(artistAlbumsSchema)
  .handler(({ data }) => spotifyService.getArtistAlbumsService(data));
