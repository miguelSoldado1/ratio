import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import { createCloudflareRateLimitMiddleware, userMutationRateLimit } from "../rate-limit";
import * as followService from "../services/follow-service";

// Schemas

const userFollowSchema = z.object({
  following: z.boolean(),
  userId: z.string().trim().min(1).max(128),
});

const userFollowsSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).max(128),
});

// Server functions

export const getUserFollowers = createServerFn()
  .validator(userFollowsSchema)
  .handler(({ data }) => followService.getUserFollowersService(data));

export const getUserFollowing = createServerFn()
  .validator(userFollowsSchema)
  .handler(({ data }) => followService.getUserFollowingService(data));

export const setUserFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .validator(userFollowSchema)
  .handler(({ context, data }) => followService.setUserFollowService(data, context));
