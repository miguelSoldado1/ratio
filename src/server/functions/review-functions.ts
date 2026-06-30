import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { authMiddleware } from "../auth-middleware";
import * as reviewService from "../services/review-service";

// Schemas

const albumIdSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
});

const albumReviewsSchema = albumIdSchema.extend({
  cursor: z.string().trim().min(1).optional(),
});

const reviewDetailSchema = albumIdSchema.extend({
  reviewId: z.uuid(),
});

const userReviewsSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).max(128),
});

const userProfileSchema = z.object({
  username: z.string().trim().min(1).max(64),
});

const userSearchSchema = z.object({
  query: z.string().trim().min(1).max(64),
});

const reviewLikeSchema = z.object({
  liked: z.boolean(),
  reviewId: z.uuid(),
});

const reviewLikesSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  reviewId: z.uuid(),
});

const deleteReviewSchema = z.object({
  reviewId: z.uuid(),
});

const createReviewSchema = z.object({
  albumId: z.string().trim().min(1).max(64),
  body: z.string().trim().max(2000).optional(),
  rating: z.number().int().min(1).max(10),
});

// Server functions

export const createReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createReviewSchema)
  .handler(({ context, data }) => reviewService.createReviewService(data, context));

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(deleteReviewSchema)
  .handler(({ context, data }) => reviewService.deleteReviewService(data, context));

export const getAlbumReviews = createServerFn()
  .validator(albumReviewsSchema)
  .handler(({ data }) => reviewService.getAlbumReviewsService(data));

export const getReviewById = createServerFn()
  .validator(reviewDetailSchema)
  .handler(({ data }) => reviewService.getReviewByIdService(data));

export const getAlbumRatingSummary = createServerFn()
  .validator(albumIdSchema)
  .handler(({ data }) => reviewService.getAlbumRatingSummaryService(data));

export const getUserReviews = createServerFn()
  .validator(userReviewsSchema)
  .handler(({ data }) => reviewService.getUserReviewsService(data));

export const getReviewLikes = createServerFn()
  .validator(reviewLikesSchema)
  .handler(({ data }) => reviewService.getReviewLikesService(data));

export const getUserProfile = createServerFn()
  .validator(userProfileSchema)
  .handler(({ data }) => reviewService.getUserProfileService(data));

export const searchUsers = createServerFn()
  .validator(userSearchSchema)
  .handler(({ data }) => reviewService.searchUsersService(data));

export const hasMyAlbumReview = createServerFn()
  .middleware([authMiddleware])
  .validator(albumIdSchema)
  .handler(({ context, data }) => reviewService.hasMyAlbumReviewService(data, context));

export const setReviewLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(reviewLikeSchema)
  .handler(({ context, data }) => reviewService.setReviewLikeService(data, context));
