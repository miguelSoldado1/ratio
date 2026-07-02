import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import * as notificationService from "../services/notification-service";

// Schemas

const getNotificationsSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
});

// Server functions

export const getUnseenNotificationCount = createServerFn()
  .middleware([authMiddleware])
  .handler(({ context }) => notificationService.getUnseenNotificationCountService(context));

export const getNotifications = createServerFn()
  .middleware([authMiddleware])
  .validator(getNotificationsSchema)
  .handler(({ context, data }) => notificationService.getNotificationsService(data, context));

export const markNotificationsSeen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => notificationService.markNotificationsSeenService(context));
