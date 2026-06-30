import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { toast } from "sonner";
import { reviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import { setReviewLike } from "@/server/functions/review-functions";
import { tryCatch } from "@/try-catch";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

interface ReviewLikePage {
  reviews: ReviewLikeItem[];
}

interface ReviewLikeItem {
  id: string;
  liked: boolean;
  likes: number;
}

interface UseReviewLikeToggleParams {
  enabled: boolean;
  queryKeys: QueryKey[];
}

export function useReviewLikeToggle<TPage extends ReviewLikePage>({ enabled, queryKeys }: UseReviewLikeToggleParams) {
  const queryClient = useQueryClient();
  const setReviewLikeFn = useServerFn(setReviewLike);
  const setReviewLikeMutation = useMutation({ mutationFn: setReviewLikeFn });

  return useCallback(
    async (reviewId: string, liked: boolean) => {
      if (!enabled) {
        return false;
      }

      const { data: updatedReview, error } = await tryCatch(
        setReviewLikeMutation.mutateAsync({ data: { liked, reviewId } })
      );
      if (error) {
        toast.error("Error", {
          description: error instanceof Error ? error.message : "Could not update review like",
        });
        return false;
      }

      for (const targetQueryKey of queryKeys) {
        queryClient.setQueryData(targetQueryKey, (data) => updateReviewLikeData<TPage>(data, updatedReview));
      }

      await queryClient.invalidateQueries({ queryKey: reviewQueryKeys.likes(updatedReview.reviewId) });
    },
    [enabled, queryClient, queryKeys, setReviewLikeMutation]
  );
}

function updateReviewLikeData<TPage extends ReviewLikePage>(
  data: unknown,
  updatedReview: { liked: boolean; likes: number; reviewId: string }
) {
  if (!data || typeof data !== "object") return data;

  if (isInfiniteReviewLikeData<TPage>(data)) {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        reviews: page.reviews.map((review) =>
          review.id === updatedReview.reviewId
            ? { ...review, liked: updatedReview.liked, likes: updatedReview.likes }
            : review
        ),
      })),
    };
  }

  if (isReviewLikeItem(data) && data.id === updatedReview.reviewId) {
    return { ...data, liked: updatedReview.liked, likes: updatedReview.likes };
  }

  return data;
}

function isInfiniteReviewLikeData<TPage extends ReviewLikePage>(data: object): data is InfiniteData<TPage> {
  return "pages" in data && Array.isArray(data.pages);
}

function isReviewLikeItem(data: object): data is ReviewLikeItem {
  return (
    "id" in data &&
    typeof data.id === "string" &&
    "liked" in data &&
    typeof data.liked === "boolean" &&
    "likes" in data &&
    typeof data.likes === "number"
  );
}
