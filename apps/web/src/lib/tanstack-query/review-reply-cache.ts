import type { InfiniteData } from "@tanstack/react-query";
import type { getReviewReplies } from "@/server/functions/review-reply-functions";

export type ReviewRepliesPage = Awaited<ReturnType<typeof getReviewReplies>>;
export type ReviewReply = ReviewRepliesPage["replies"][number];
export type ReviewRepliesData = InfiniteData<ReviewRepliesPage>;

export interface ReviewReplyCountPage {
  reviews: {
    id: string;
    replyCount?: number;
  }[];
}

interface ReplyIdentity {
  createdAt: Date;
  id: string;
}

interface ReplyLikeUpdate {
  liked: boolean;
  likes: number;
  replyId: string;
}

export function flattenReviewReplies(data: ReviewRepliesData | undefined) {
  return sortAndDedupeReviewReplies(data?.pages.flatMap((page) => page.replies) ?? []);
}

function sortAndDedupeReviewReplies<TReply extends ReplyIdentity>(replies: TReply[]) {
  const repliesById = new Map<string, TReply>();

  for (const reply of replies) {
    repliesById.set(reply.id, reply);
  }

  return [...repliesById.values()].sort(compareReviewReplies);
}

export function addReviewReply(
  data: ReviewRepliesData | undefined,
  reply: ReviewReply,
  { appendToLoadedPages }: { appendToLoadedPages: boolean }
) {
  if (!data) return data;

  const firstPage = data.pages[0];
  const lastPageIndex = data.pages.length - 1;

  return {
    ...data,
    pages: data.pages.map((page, pageIndex) => ({
      ...page,
      replies:
        appendToLoadedPages && pageIndex === lastPageIndex
          ? sortAndDedupeReviewReplies([...page.replies, reply])
          : page.replies,
      totalCount:
        pageIndex === 0 && firstPage?.totalCount !== null && firstPage?.totalCount !== undefined
          ? firstPage.totalCount + 1
          : page.totalCount,
    })),
  };
}

export function reconcileReviewReplyLocalTail(localTail: ReviewReply[], loadedReplies: ReviewReply[]) {
  const loadedReplyIds = new Set(loadedReplies.map((reply) => reply.id));

  return sortAndDedupeReviewReplies(localTail).filter((reply) => !loadedReplyIds.has(reply.id));
}

export function removeReviewReply(
  data: ReviewRepliesData | undefined,
  replyId: string,
  authoritativeTotalCount: number
) {
  if (!data) return data;

  return {
    ...data,
    pages: data.pages.map((page, pageIndex) => ({
      ...page,
      replies: page.replies.filter((reply) => reply.id !== replyId),
      totalCount: pageIndex === 0 ? authoritativeTotalCount : page.totalCount,
    })),
  };
}

export function updateReviewReplyLike(data: ReviewRepliesData | undefined, update: ReplyLikeUpdate) {
  if (!data) return data;

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      replies: page.replies.map((reply) =>
        reply.id === update.replyId ? { ...reply, liked: update.liked, likes: update.likes } : reply
      ),
    })),
  };
}

export function updateReviewReplyCountInPages<TPage extends ReviewReplyCountPage>(
  data: InfiniteData<TPage> | undefined,
  reviewId: string,
  updateCount: (replyCount: number) => number
): InfiniteData<TPage> | undefined {
  if (!data) return data;

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      reviews: page.reviews.map((review) =>
        review.id === reviewId && review.replyCount !== undefined
          ? { ...review, replyCount: updateCount(review.replyCount) }
          : review
      ),
    })),
  };
}

export function isReviewReplyCountData(data: unknown): data is InfiniteData<ReviewReplyCountPage> {
  if (typeof data !== "object" || data === null || !("pages" in data)) return false;

  const { pages } = data as { pages: unknown };

  return (
    Array.isArray(pages) &&
    pages.every(
      (page) =>
        typeof page === "object" &&
        page !== null &&
        "reviews" in page &&
        Array.isArray((page as { reviews: unknown }).reviews)
    )
  );
}

function compareReviewReplies(a: ReplyIdentity, b: ReplyIdentity) {
  const createdAtDifference = a.createdAt.getTime() - b.createdAt.getTime();

  return createdAtDifference || a.id.localeCompare(b.id);
}
