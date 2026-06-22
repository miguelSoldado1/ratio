import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ReviewCard } from "@/components/review-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import { deleteReview, getAlbumReviews, setReviewLike } from "@/server/functions/review-functions";
import { tryCatch } from "@/try-catch";
import { DeleteReviewDialog } from "./delete-review-dialog";
import type { InfiniteData } from "@tanstack/react-query";
import type { AlbumReviewsPage } from "@/server/functions/review-functions";

interface ReviewsSectionProps {
  albumId: string;
  className?: string;
}

export function ReviewsSection({ albumId, className }: ReviewsSectionProps) {
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const hasSession = Boolean(userId);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const getAlbumReviewsFn = useServerFn(getAlbumReviews);
  const albumReviewsQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getAlbumReviewsFn({ data: { albumId, cursor: pageParam ?? undefined } }),
    queryKey: albumQueryKeys.reviews(albumId, userId),
  });

  const setReviewLikeFn = useServerFn(setReviewLike);
  const setReviewLikeMutation = useMutation({ mutationFn: setReviewLikeFn });

  const deleteReviewFn = useServerFn(deleteReview);
  const deleteReviewMutation = useMutation({ mutationFn: deleteReviewFn });

  const reviews = albumReviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = albumReviewsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  async function handleReviewLikeToggle(reviewId: string, liked: boolean) {
    if (!hasSession) {
      return false;
    }

    const { data: updatedReview, error } = await tryCatch(
      setReviewLikeMutation.mutateAsync({ data: { liked, reviewId } })
    );
    if (error) {
      toast.error("Error", { description: error instanceof Error ? error.message : "Could not update review like" });
      return false;
    }

    queryClient.setQueryData<InfiniteData<AlbumReviewsPage>>(albumQueryKeys.reviews(albumId, userId), (data) => {
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
  }

  async function handleReviewDelete(reviewId: string) {
    setDeletingReviewId(reviewId);
    const { error } = await tryCatch(deleteReviewMutation.mutateAsync({ data: { reviewId } }));
    setDeletingReviewId(null);

    if (error) {
      toast.error("Error", { description: error instanceof Error ? error.message : "Could not delete review" });
      return false;
    }

    await queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(albumId) });
    toast.success("Success", { description: "Review deleted" });

    return true;
  }

  if (albumReviewsQuery.isPending) {
    return <ReviewsSectionSkeleton className={className} />;
  }

  if (albumReviewsQuery.isError && reviews.length === 0) {
    return (
      <section className={cn("border-border/80 border-t py-8", className)}>
        <p className="font-medium text-sm">Reviews unavailable</p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">Could not load reviews for this album.</p>
      </section>
    );
  }

  if (reviews.length === 0) {
    return (
      <section className={cn("border-border/80 border-t py-8", className)}>
        <p className="font-medium text-sm">No reviews yet</p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          Reviews will appear here once people start rating this album.
        </p>
      </section>
    );
  }

  return (
    <section className={className}>
      {reviews.map((review) => (
        <ReviewCard.Root className="border-border/80" key={review.id}>
          <ReviewCard.Header createdAt={review.createdAt} href={`/user/${review.user.username}`} user={review.user} />
          <ReviewCard.Rating value={review.rating} />
          {review.review ? <ReviewCard.Review>{review.review}</ReviewCard.Review> : null}
          <ReviewCard.Footer>
            <ReviewCard.Likes
              count={review.likes}
              disabled={!hasSession}
              liked={review.liked}
              onToggle={hasSession ? (liked) => handleReviewLikeToggle(review.id, liked) : undefined}
            />
            {review.canDelete ? (
              <DeleteReviewDialog
                className="ml-auto"
                isDeleting={deletingReviewId === review.id}
                onDelete={() => handleReviewDelete(review.id)}
              />
            ) : null}
          </ReviewCard.Footer>
        </ReviewCard.Root>
      ))}
      <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
      {isFetchingNextPage ? <LoadingMoreReviews /> : null}
    </section>
  );
}

function LoadingMoreReviews() {
  return (
    <div className="flex justify-center border-border/80 border-t py-6">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

function ReviewsSectionSkeleton({ className }: { className?: string }) {
  return (
    <section aria-label="Loading album reviews" className={cn("border-border/80 border-t py-8", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="mt-4 h-4 w-20" />
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-5/6 max-w-xl" />
      </div>
    </section>
  );
}
