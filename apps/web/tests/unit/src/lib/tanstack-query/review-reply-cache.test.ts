import { describe, expect, it } from "vitest";
import {
  addReviewReply,
  flattenReviewReplies,
  isReviewReplyCountData,
  reconcileReviewReplyLocalTail,
  removeReviewReply,
  updateReviewReplyCountInPages,
  updateReviewReplyLike,
} from "@/lib/tanstack-query/review-reply-cache";
import type { InfiniteData } from "@tanstack/react-query";
import type {
  ReviewRepliesData,
  ReviewRepliesPage,
  ReviewReply,
  ReviewReplyCountPage,
} from "@/lib/tanstack-query/review-reply-cache";

describe("review reply cache helpers", () => {
  it("flattens, sorts, and deduplicates paginated replies", () => {
    const later = createReply({ createdAt: new Date("2026-01-02T00:00:00.000Z"), id: "reply-c" });
    const sameTimeB = createReply({ createdAt: new Date("2026-01-01T00:00:00.000Z"), id: "reply-b" });
    const sameTimeA = createReply({ createdAt: new Date("2026-01-01T00:00:00.000Z"), id: "reply-a" });
    const data = createData([
      createPage({ nextCursor: "next", replies: [sameTimeB, later], totalCount: 3 }),
      createPage({ replies: [sameTimeA, later], totalCount: null }),
    ]);

    expect(flattenReviewReplies(data).map((reply) => reply.id)).toEqual(["reply-a", "reply-b", "reply-c"]);
  });

  it("appends a reply to a fully loaded thread and increments the retained total", () => {
    const first = createReply({ id: "reply-a" });
    const created = createReply({ createdAt: new Date("2026-01-02T00:00:00.000Z"), id: "reply-b" });
    const data = createData([createPage({ replies: [first], totalCount: 1 })]);

    const updated = addReviewReply(data, created, { appendToLoadedPages: true });

    expect(updated?.pages[0]?.replies.map((reply) => reply.id)).toEqual(["reply-a", "reply-b"]);
    expect(updated?.pages[0]?.totalCount).toBe(2);
  });

  it("keeps a created reply in a deduplicated local tail while later pages remain", () => {
    const loaded = createReply({ id: "reply-a" });
    const created = createReply({ id: "reply-z" });
    const data = createData([createPage({ nextCursor: "next", replies: [loaded], totalCount: 4 })]);
    const updated = addReviewReply(data, created, { appendToLoadedPages: false });

    expect(updated?.pages[0]?.replies).toEqual([loaded]);
    expect(updated?.pages[0]?.totalCount).toBe(5);
    expect(reconcileReviewReplyLocalTail([created], [loaded])).toEqual([created]);
    expect(reconcileReviewReplyLocalTail([created], [loaded, created])).toEqual([]);
  });

  it("removes a reply with the authoritative total and patches like state narrowly", () => {
    const first = createReply({ id: "reply-a" });
    const second = createReply({ id: "reply-b" });
    const data = createData([createPage({ replies: [first, second], totalCount: 2 })]);
    const liked = updateReviewReplyLike(data, { liked: true, likes: 1, replyId: second.id });
    const removed = removeReviewReply(liked, first.id, 1);

    expect(removed?.pages[0]?.replies).toEqual([{ ...second, liked: true, likes: 1 }]);
    expect(removed?.pages[0]?.totalCount).toBe(1);
  });
});

describe("review reply count cache helpers", () => {
  it("patches only the matching hydrated review across loaded pages", () => {
    const data: InfiniteData<ReviewReplyCountPage> = {
      pageParams: [null, "cursor-1"],
      pages: [
        {
          reviews: [
            { id: "review-a", replyCount: 0 },
            { id: "review-b", replyCount: 3 },
          ],
        },
        { reviews: [{ id: "review-a" }] },
      ],
    };

    const updated = updateReviewReplyCountInPages(data, "review-a", (replyCount) => replyCount + 1);

    expect(updated?.pages[0]?.reviews[0]?.replyCount).toBe(1);
    expect(updated?.pages[0]?.reviews[1]?.replyCount).toBe(3);
    expect(updated?.pages[1]?.reviews[0]?.replyCount).toBeUndefined();
    expect(updateReviewReplyCountInPages(undefined, "review-a", (count) => count)).toBeUndefined();
  });

  it("distinguishes review-list pages from unrelated profile cache data", () => {
    expect(isReviewReplyCountData({ id: "profile-a", username: "alice" })).toBe(false);
    expect(isReviewReplyCountData({ pageParams: [null], pages: [{ users: [] }] })).toBe(false);
    expect(isReviewReplyCountData({ pageParams: [null], pages: [{ reviews: [] }] })).toBe(true);
  });
});

function createData(pages: ReviewRepliesPage[]): ReviewRepliesData {
  return { pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index}`)), pages };
}

function createPage({
  nextCursor = null,
  replies = [],
  totalCount = 0,
}: Partial<ReviewRepliesPage> = {}): ReviewRepliesPage {
  return { nextCursor, replies, totalCount };
}

function createReply(overrides: Partial<ReviewReply> = {}): ReviewReply {
  return {
    body: "A thoughtful reply",
    canDelete: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "reply-a",
    liked: false,
    likes: 0,
    reviewId: "review-a",
    user: {
      avatarUrl: null,
      displayUsername: "Alice",
      id: "user-a",
      username: "alice",
    },
    ...overrides,
  };
}
