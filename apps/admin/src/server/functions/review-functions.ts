import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { requireAdminMiddleware } from "../admin-middleware";
import * as reviewsService from "../services/review-service";
import { getTableDataInput } from "../table-query";

// Schemas

const deleteReviewInput = z.object({
  reviewId: z.uuid(),
});

// Server functions

export const getTableReviews = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(getTableDataInput)
  .handler(({ context, data }) => reviewsService.getTableReviewsService(data, context));

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(deleteReviewInput)
  .handler(({ context, data }) => reviewsService.deleteReviewService(data.reviewId, context));
