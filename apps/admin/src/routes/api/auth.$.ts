import { createFileRoute } from "@tanstack/react-router";
import { handleAdminAuthRequest } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => await handleAdminAuthRequest(request),
      POST: async ({ request }: { request: Request }) => await handleAdminAuthRequest(request),
    },
  },
});
