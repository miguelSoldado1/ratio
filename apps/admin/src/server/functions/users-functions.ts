import { createServerFn } from "@tanstack/react-start";
import { requireAdminMiddleware } from "../admin-middleware";
import * as usersService from "../services/users-service";
import { getTableDataInput } from "../table-query";

// Server functions

export const getTableUsers = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(getTableDataInput)
  .handler(({ context, data }) => usersService.getTableUsersService(data, context));
