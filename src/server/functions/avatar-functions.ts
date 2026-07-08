import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import { createCloudflareRateLimitMiddleware, userMutationRateLimit } from "../rate-limit";
import * as avatarService from "../services/avatar-service";

// Schemas

const setAvatarSchema = z.object({
  objectKey: z.string().trim().min(1).max(512),
});

// Server functions

export const setMyAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .validator(setAvatarSchema)
  .handler(({ context, data }) => avatarService.setMyAvatarService(data, context));

export const removeMyAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .handler(({ context }) => avatarService.removeMyAvatarService(context));
