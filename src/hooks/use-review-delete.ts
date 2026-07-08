import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { deleteReview as deleteReviewServerFn } from "@/server/functions/review-functions";
import { tryCatch } from "@/try-catch";

interface DeletedReview {
  albumId: string;
  id: string;
}

interface UseReviewDeleteParams {
  onDeleted?: (deletedReview: DeletedReview) => Promise<void> | void;
}

export function useReviewDelete({ onDeleted }: UseReviewDeleteParams = {}) {
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const deleteReviewFn = useServerFn(deleteReviewServerFn);
  const deleteReviewMutation = useMutation({ mutationFn: deleteReviewFn });

  const deleteReview = useCallback(
    async (reviewId: string) => {
      setDeletingReviewId(reviewId);
      try {
        const { data: deletedReview, error } = await tryCatch(deleteReviewMutation.mutateAsync({ data: { reviewId } }));

        if (error) {
          toast.error("Couldn't delete review", {
            description: error instanceof Error ? error.message : "Something went wrong. Try again.",
          });
          return false;
        }

        const { error: deletedError } = await tryCatch(Promise.resolve(onDeleted?.(deletedReview)));

        if (deletedError) {
          toast.error("Couldn't refresh reviews", {
            description: deletedError instanceof Error ? deletedError.message : "Something went wrong. Try again.",
          });
          return false;
        }

        return true;
      } finally {
        setDeletingReviewId(null);
      }
    },
    [deleteReviewMutation, onDeleted]
  );

  return { deleteReview, deletingReviewId };
}
