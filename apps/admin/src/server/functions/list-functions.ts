import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { requireAdminMiddleware } from "../admin-middleware";
import * as listsService from "../services/list-service";
import { getTableDataInput } from "../table-query";

// Schemas

const deleteListInput = z.object({
  listId: z.uuid(),
});

// Server functions

export const getTableLists = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(getTableDataInput)
  .handler(({ context, data }) => listsService.getTableListsService(data, context));

export const getListStats = createServerFn()
  .middleware([requireAdminMiddleware])
  .handler(({ context }) => listsService.getListStatsService(context));

export const deleteList = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(deleteListInput)
  .handler(({ context, data }) => listsService.deleteListService(data.listId, context));
