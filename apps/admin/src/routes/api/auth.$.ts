import { createFileRoute } from "@tanstack/react-router";
import { handleAdminAuthRequest } from "@/lib/auth.server";
import { enforceAdminAuthRateLimit } from "@/server/rate-limit";

async function handleRateLimitedAuthRequest(request: Request) {
  const rateLimitResponse = await enforceAdminAuthRateLimit(request);

  return rateLimitResponse ?? (await handleAdminAuthRequest(request));
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => await handleRateLimitedAuthRequest(request),
      POST: async ({ request }: { request: Request }) => await handleRateLimitedAuthRequest(request),
    },
  },
});
