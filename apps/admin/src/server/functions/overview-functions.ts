import { createServerFn } from "@tanstack/react-start";
import { requireAdminMiddleware } from "../admin-middleware";
import { getOverviewStatsService } from "../services/overview-service";

export const getOverviewStats = createServerFn()
  .middleware([requireAdminMiddleware])
  .handler(({ context }) => getOverviewStatsService(context));
