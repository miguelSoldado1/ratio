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
      const { data: deletedReview, error } = await tryCatch(deleteReviewMutation.mutateAsync({ data: { reviewId } }));
      setDeletingReviewId(null);

      if (error) {
        toast.error("Error", { description: error instanceof Error ? error.message : "Could not delete review" });
        return false;
      }

      const { error: deletedError } = await tryCatch(Promise.resolve(onDeleted?.(deletedReview)));

      if (deletedError) {
        toast.error("Error", {
          description: deletedError instanceof Error ? deletedError.message : "Could not refresh review data",
        });
        return false;
      }

      return true;
    },
    [deleteReviewMutation, onDeleted]
  );

  return { deleteReview, deletingReviewId };
}
