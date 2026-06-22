import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import * as spotifyService from "../services/spotify-service";

// Schemas

const searchAlbumsSchema = z.object({
  query: z.string().trim().min(1).max(100),
});

const albumDetailsSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
});

// Server functions

export const searchAlbums = createServerFn()
  .validator(searchAlbumsSchema)
  .handler(({ data }) => spotifyService.searchAlbumsService(data));

export const getAlbumDetails = createServerFn()
  .validator(albumDetailsSchema)
  .handler(({ data }) => spotifyService.getAlbumDetailsService(data));
