import { createServerFn } from "@tanstack/react-start";
import { adminSessionMiddleware } from "./admin-middleware";

export const getAdminAccessState = createServerFn({ method: "GET" })
  .middleware([adminSessionMiddleware])
  .handler(({ context }) => context.access);
