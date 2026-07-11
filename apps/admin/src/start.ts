import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { withSecurityHeaders } from "./security-headers";

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === "serverFn",
});

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  return { ...result, response: withSecurityHeaders(request, result.response) };
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, securityHeadersMiddleware],
}));
