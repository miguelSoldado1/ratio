import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { toast } from "sonner";
import { reviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import { setReviewLike } from "@/server/functions/review-functions";
import { tryCatch } from "@/try-catch";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

interface ReviewLikePage {
  reviews: {
    id: string;
    liked: boolean;
    likes: number;
  }[];
}

interface UseReviewLikeToggleParams {
  enabled: boolean;
  queryKey: QueryKey;
}

export function useReviewLikeToggle<TPage extends ReviewLikePage>({ enabled, queryKey }: UseReviewLikeToggleParams) {
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

      queryClient.setQueryData<InfiniteData<TPage>>(queryKey, (data) => {
        if (!data) return data;

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
      });

      await queryClient.invalidateQueries({ queryKey: reviewQueryKeys.likes(updatedReview.reviewId) });
    },
    [enabled, queryClient, queryKey, setReviewLikeMutation]
  );
}
