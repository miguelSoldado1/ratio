import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@test/react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateReviewReply } from "@/hooks/use-create-review-reply";
import { albumQueryKeys, feedQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import type { InfiniteData } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ReviewReplyCountPage } from "@/lib/tanstack-query/review-reply-cache";

const mockServerFn = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn(() => mockServerFn),
}));

vi.mock("@/server/functions/review-reply-functions", () => ({
  createReviewReply: {},
}));

beforeEach(() => {
  mockServerFn.mockReset();
});

describe("useCreateReviewReply", () => {
  it("creates a reply and patches matching album, feed, and profile counts", async () => {
    const queryClient = createTestQueryClient();
    const albumKey = albumQueryKeys.reviews("album-a");
    const feedKey = feedQueryKeys.root("viewer-a");
    const profileReviewsKey = userQueryKeys.reviews("author-a", "viewer-a");
    queryClient.setQueryData(albumKey, createCountData());
    queryClient.setQueryData(feedKey, createCountData());
    queryClient.setQueryData(profileReviewsKey, createCountData());
    mockServerFn.mockResolvedValue(createReply());
    const { result } = renderHook(() => useCreateReviewReply(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await expect(result.current.createReply("review-a", "Great point")).resolves.toMatchObject({
        error: null,
        reply: { id: "reply-a" },
      });
    });

    expect(mockServerFn.mock.calls[0]?.[0]).toEqual({ data: { body: "Great point", reviewId: "review-a" } });
    expect(
      queryClient.getQueryData<InfiniteData<ReviewReplyCountPage>>(albumKey)?.pages[0]?.reviews[0]?.replyCount
    ).toBe(1);
    expect(
      queryClient.getQueryData<InfiniteData<ReviewReplyCountPage>>(feedKey)?.pages[0]?.reviews[0]?.replyCount
    ).toBe(1);
    expect(
      queryClient.getQueryData<InfiniteData<ReviewReplyCountPage>>(profileReviewsKey)?.pages[0]?.reviews[0]?.replyCount
    ).toBe(1);
  });

  it("returns a useful error and leaves counts unchanged", async () => {
    const queryClient = createTestQueryClient();
    const albumKey = albumQueryKeys.reviews("album-a");
    const originalData = createCountData();
    queryClient.setQueryData(albumKey, originalData);
    mockServerFn.mockRejectedValue(new Error("Rate limited"));
    const { result } = renderHook(() => useCreateReviewReply(), { wrapper: createWrapper(queryClient) });

    await expect(result.current.createReply("review-a", "Again")).resolves.toEqual({
      error: "Rate limited",
      reply: null,
    });
    expect(queryClient.getQueryData(albumKey)).toEqual(originalData);
  });
});

function createCountData(): InfiniteData<ReviewReplyCountPage> {
  return {
    pageParams: [null],
    pages: [{ reviews: [{ id: "review-a", replyCount: 0 }] }],
  };
}

function createReply() {
  return {
    body: "Great point",
    canDelete: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "reply-a",
    liked: false,
    likes: 0,
    reviewId: "review-a",
    user: {
      avatarUrl: null,
      displayUsername: "Viewer",
      id: "viewer-a",
      username: "viewer",
    },
  };
}

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
