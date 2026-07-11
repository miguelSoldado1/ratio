import { createFileRoute } from "@tanstack/react-router";
import { handleAuthRequest } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => await handleAuthRequest(request),
      POST: async ({ request }: { request: Request }) => await handleAuthRequest(request),
    },
  },
});
