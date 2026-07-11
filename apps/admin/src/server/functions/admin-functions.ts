import { createServerFn } from "@tanstack/react-start";
import { adminSessionMiddleware } from "../admin-middleware";
import * as adminAccessService from "../services/admin-access-service";

// Server functions

export const getAdminAccessState = createServerFn({ method: "GET" })
  .middleware([adminSessionMiddleware])
  .handler(({ context }) => adminAccessService.getAdminAccessStateService(context));
