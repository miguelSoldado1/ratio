import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth-middleware";
import { createCloudflareRateLimitMiddleware, spotifyRecentRotationRateLimit } from "../rate-limit";
import * as spotifyRecentRotationService from "../services/spotify-recent-rotation-service";

export const getMyRecentRotation = createServerFn()
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(spotifyRecentRotationRateLimit)])
  .handler(({ context }) => spotifyRecentRotationService.getMyRecentRotationService(context));
