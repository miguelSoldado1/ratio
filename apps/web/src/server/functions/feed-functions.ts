import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import * as feedService from "../services/feed-service";

// Schemas

const feedCursorMaxLength = 8192;

const feedSchema = z.object({
  cursor: z.string().trim().min(1).max(feedCursorMaxLength).optional(),
});

// Server functions

export const getFeed = createServerFn()
  .validator(feedSchema)
  .handler(({ data }) => feedService.getFeedService(data));

export const getFollowingFeed = createServerFn()
  .middleware([authMiddleware])
  .validator(feedSchema)
  .handler(({ context, data }) => feedService.getFollowingFeedService(data, context));
