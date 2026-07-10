import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import * as adminService from "../services/admin-service";

// Schemas

const adminUsersSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  query: z.string().trim().max(128).optional(),
});

const adminUserBanSchema = z.object({
  banned: z.boolean(),
  userId: z.string().trim().min(1).max(128),
});

// Server functions

export const listAdminUsers = createServerFn()
  .middleware([authMiddleware])
  .validator(adminUsersSchema)
  .handler(({ context, data }) => adminService.listAdminUsersService(data, context));

export const setAdminUserBan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(adminUserBanSchema)
  .handler(({ context, data }) => adminService.setAdminUserBanService(data, context));
