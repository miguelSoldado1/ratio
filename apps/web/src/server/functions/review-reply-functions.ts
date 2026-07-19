import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import { createCloudflareRateLimitMiddleware, replyCreateRateLimit, userMutationRateLimit } from "../rate-limit";
import * as reviewReplyService from "../services/review-reply-service";

// Schemas

const reviewRepliesSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  reviewId: z.uuid(),
});

const reviewReplyLikesSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  replyId: z.uuid(),
});

const createReviewReplySchema = z.object({
  body: z.string().trim().min(1).max(500),
  reviewId: z.uuid(),
});

const deleteReviewReplySchema = z.object({
  replyId: z.uuid(),
});

const reviewReplyLikeSchema = deleteReviewReplySchema.extend({
  liked: z.boolean(),
});

// Server functions

export const getReviewReplies = createServerFn()
  .validator(reviewRepliesSchema)
  .handler(({ data }) => reviewReplyService.getReviewRepliesService(data));

export const getReviewReplyLikes = createServerFn()
  .validator(reviewReplyLikesSchema)
  .handler(({ data }) => reviewReplyService.getReviewReplyLikesService(data));

export const createReviewReply = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(replyCreateRateLimit)])
  .validator(createReviewReplySchema)
  .handler(({ context, data }) => reviewReplyService.createReviewReplyService(data, context));

export const deleteReviewReply = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .validator(deleteReviewReplySchema)
  .handler(({ context, data }) => reviewReplyService.deleteReviewReplyService(data, context));

export const setReviewReplyLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware, createCloudflareRateLimitMiddleware(userMutationRateLimit)])
  .validator(reviewReplyLikeSchema)
  .handler(({ context, data }) => reviewReplyService.setReviewReplyLikeService(data, context));
