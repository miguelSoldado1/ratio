import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import * as followService from "../services/follow-service";

const userFollowSchema = z.object({
  following: z.boolean(),
  userId: z.string().trim().min(1).max(128),
});

export const setUserFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(userFollowSchema)
  .handler(({ context, data }) => followService.setUserFollowService(data, context));
