import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import {
  createCloudflareRateLimitMiddleware,
  createFixedWindowRateLimitMiddleware,
  listCreateHourlyRateLimit,
  spotifyAlbumDetailsRateLimit,
  userMutationRateLimit,
} from "../rate-limit";
import * as listService from "../services/list-service";

// Schemas

const listDetailsInputSchema = z.object({
  // The description renders as a one-block subtitle, so line breaks collapse to spaces rather than
  // being stored and then silently flattened at display time.
  description: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((description) => description?.replace(/\s+/g, " ").trim() || null),
  title: z.string().trim().min(1).max(100),
});

const listIdSchema = z.object({
  listId: z.uuid(),
});

const listItemSchema = listIdSchema.extend({
  albumId: z.string().trim().min(1).max(64),
});

const myListsForAlbumSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
  cursor: z.string().trim().min(1).max(2048).optional(),
});

const updateListSchema = listDetailsInputSchema.extend({
  listId: z.uuid(),
});

const userListsSchema = z.object({
  cursor: z.string().trim().min(1).max(2048).optional(),
  userId: z.string().trim().min(1).max(128),
});

// Server functions

export const getList = createServerFn()
  .validator(listIdSchema)
  .handler(({ data }) => listService.getListService(data));

export const getUserLists = createServerFn()
  .validator(userListsSchema)
  .handler(({ data }) => listService.getUserListsService(data));

export const getMyListsForAlbum = createServerFn()
  .middleware([authMiddleware])
  .validator(myListsForAlbumSchema)
  .handler(({ context, data }) => listService.getMyListsForAlbumService(data, context));

export const createList = createServerFn({ method: "POST" })
  .middleware([
    authMiddleware,
    createCloudflareRateLimitMiddleware(userMutationRateLimit),
    createFixedWindowRateLimitMiddleware(listCreateHourlyRateLimit),
  ])
  .validator(listDetailsInputSchema)
  .handler(({ context, data }) => listService.createListService(data, context));

export const updateList = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .validator(updateListSchema)
  .handler(({ context, data }) => listService.updateListService(data, context));

export const deleteList = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .validator(listIdSchema)
  .handler(({ context, data }) => listService.deleteListService(data, context));

export const addListItem = createServerFn({ method: "POST" })
  .middleware([
    authMiddleware,
    createCloudflareRateLimitMiddleware(spotifyAlbumDetailsRateLimit),
    createCloudflareRateLimitMiddleware(userMutationRateLimit),
  ])
  .validator(listItemSchema)
  .handler(({ context, data }) => listService.addListItemService(data, context));

export const removeListItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .validator(listItemSchema)
  .handler(({ context, data }) => listService.removeListItemService(data, context));
