import { createServerFn } from "@tanstack/react-start";
import z from "zod";
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
