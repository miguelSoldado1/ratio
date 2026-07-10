import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@test/react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { reviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import type { InfiniteData } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockServerFn = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn(() => mockServerFn),
}));

vi.mock("@/server/functions/review-functions", () => ({
  setReviewLike: {},
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

beforeEach(() => {
  mockServerFn.mockReset();
  mockToastError.mockReset();
});

describe("useReviewLikeToggle", () => {
  it("disabled state returns false and does not mutate", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ["reviews"];
    const { result } = renderHook(() => useReviewLikeToggle({ enabled: false, queryKeys: [queryKey] }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current("review_1", true)).resolves.toBe(false);
    expect(mockServerFn).not.toHaveBeenCalled();
  });

  it("successful mutation updates infinite query review item", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ["reviews"];
    queryClient.setQueryData<InfiniteData<{ reviews: { id: string; liked: boolean; likes: number }[] }>>(queryKey, {
      pageParams: [],
      pages: [{ reviews: [{ id: "review_1", liked: false, likes: 2 }] }],
    });
    mockServerFn.mockResolvedValue({ liked: true, likes: 3, reviewId: "review_1" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useReviewLikeToggle({ enabled: true, queryKeys: [queryKey] }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current("review_1", true);
    });

    expect(
      queryClient.getQueryData<InfiniteData<{ reviews: { liked: boolean; likes: number }[] }>>(queryKey)?.pages[0]
    ).toEqual({ reviews: [{ id: "review_1", liked: true, likes: 3 }] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: reviewQueryKeys.likes("review_1") });
  });

  it("successful mutation updates single review detail item", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ["review-detail"];
    queryClient.setQueryData(queryKey, { id: "review_1", liked: false, likes: 2 });
    mockServerFn.mockResolvedValue({ liked: true, likes: 3, reviewId: "review_1" });
    const { result } = renderHook(() => useReviewLikeToggle({ enabled: true, queryKeys: [queryKey] }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current("review_1", true);
    });

    expect(queryClient.getQueryData(queryKey)).toEqual({ id: "review_1", liked: true, likes: 3 });
  });

  it("error shows toast and leaves cache unchanged", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ["review-detail"];
    queryClient.setQueryData(queryKey, { id: "review_1", liked: false, likes: 2 });
    mockServerFn.mockRejectedValue(new Error("Nope"));
    const { result } = renderHook(() => useReviewLikeToggle({ enabled: true, queryKeys: [queryKey] }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current("review_1", true)).resolves.toBe(false);

    expect(queryClient.getQueryData(queryKey)).toEqual({ id: "review_1", liked: false, likes: 2 });
    expect(mockToastError).toHaveBeenCalledWith("Couldn't update like", { description: "Nope" });
  });
});

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
