import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import { DeleteReviewDialog } from "@/components/delete-review-dialog";
import { ReviewCard } from "@/components/review-card";
import { ReviewLikesDialog } from "@/components/review-likes-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import { getAlbumReviews } from "@/server/functions/review-functions";
import { getAlbumArtistNames } from "./album-format.ts";
import { ReviewsSectionSkeleton } from "./reviews-section-skeleton";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";
import type { AlbumReviewsPage } from "@/server/services/review-service";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;
type SpotifyAlbum = SpotifyAlbumDetails["album"];

interface ReviewsSectionProps {
  album: SpotifyAlbum;
  className?: string;
}

export function ReviewsSection({ album, className }: ReviewsSectionProps) {
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const hasSession = Boolean(userId);
  const viewer = useMemo(() => ({ hasSession, userId }), [hasSession, userId]);
  const { adminModeEnabled, isAdmin } = useAdminMode();
  const [likesReviewId, setLikesReviewId] = useState<string>();
  const albumArtist = getAlbumArtistNames(album);
  const reviewsQueryKey = albumQueryKeys.reviews(album.id, userId);

  const getAlbumReviewsFn = useServerFn(getAlbumReviews);
  const albumReviewsQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getAlbumReviewsFn({ data: { albumId: album.id, cursor: pageParam ?? undefined } }),
    queryKey: reviewsQueryKey,
  });

  const handleReviewLikeToggle = useReviewLikeToggle<AlbumReviewsPage>({
    enabled: hasSession,
    queryKeys: [reviewsQueryKey],
  });

  const handleReviewDeleted = useCallback(
    () => queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(album.id) }),
    [album.id, queryClient]
  );
  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete({
    onDeleted: handleReviewDeleted,
  });

  const reviews = albumReviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = albumReviewsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

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
    <>
      <section className={className}>
        {reviews.map((review) => (
          <ReviewCard.Root className="border-border/80" key={review.id}>
            <ReviewCard.Header createdAt={review.createdAt} user={review.user} />
            <ReviewCard.Rating value={review.rating} />
            {review.review ? <ReviewCard.Review>{review.review}</ReviewCard.Review> : null}
            <ReviewCard.Footer>
              <ReviewCard.Likes
                count={review.likes}
                disabled={!hasSession}
                liked={review.liked}
                onShowLikes={() => setLikesReviewId(review.id)}
                onToggle={hasSession ? (liked) => handleReviewLikeToggle(review.id, liked) : undefined}
              />
              <ReviewCard.Share
                album={{ artist: albumArtist, id: album.id, title: album.title }}
                rating={review.rating}
                reviewBody={review.review}
                reviewId={review.id}
                userDisplayName={review.user.displayUsername}
              />
              {review.canDelete || (isAdmin && adminModeEnabled) ? (
                <DeleteReviewDialog
                  className="-mr-2 ml-auto"
                  isDeleting={deletingReviewId === review.id}
                  onDelete={() => handleReviewDelete(review.id)}
                  variant={review.canDelete ? "own" : "admin"}
                />
              ) : null}
            </ReviewCard.Footer>
          </ReviewCard.Root>
        ))}
        <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
        {isFetchingNextPage ? <LoadingMoreReviews /> : null}
      </section>
      <ReviewLikesDialog
        onOpenChange={(open) => {
          if (!open) setLikesReviewId(undefined);
        }}
        open={Boolean(likesReviewId)}
        reviewId={likesReviewId}
        viewer={viewer}
      />
    </>
  );
}

function LoadingMoreReviews() {
  return (
    <div className="flex justify-center border-border/80 border-t py-6">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
