import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { enforceAdminRequestRateLimit } from "@/server/rate-limit";
import { withSecurityHeaders } from "./security-headers";

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === "serverFn",
});

// First in the chain so throttled traffic never reaches a session lookup.
const rateLimitMiddleware = createMiddleware().server(async ({ next, request }) => {
  const rateLimitResponse = await enforceAdminRequestRateLimit(request);

  return rateLimitResponse ?? (await next());
});

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  return { ...result, response: withSecurityHeaders(request, result.response) };
});

export const startInstance = createStart(() => ({
  requestMiddleware: [rateLimitMiddleware, csrfMiddleware, securityHeadersMiddleware],
}));
