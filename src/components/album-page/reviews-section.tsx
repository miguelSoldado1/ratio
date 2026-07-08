import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import { EmptyState } from "@/components/empty-state";
import { InlineError } from "@/components/inline-error";
import { ReviewCard } from "@/components/review-card";
import { ReviewList } from "@/components/review-list";
import { ReviewManagementMenu } from "@/components/review-management-menu";
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
        <h2 className="heading-section mb-4">Reviews</h2>
        <InlineError
          className="py-0"
          description="Could not load reviews for this album."
          title="Reviews unavailable"
        />
      </section>
    );
  }

  if (reviews.length === 0) {
    return (
      <section className={cn("border-border/80 border-t py-8", className)}>
        <h2 className="heading-section mb-4">Reviews</h2>
        <EmptyState
          className="py-0"
          description="Reviews will appear here once people start rating this album."
          title="No reviews yet"
        />
      </section>
    );
  }

  return (
    <section className={className}>
      <h2 className="heading-section mb-3">Reviews</h2>
      <ReviewList
        isFetchingNextPage={isFetchingNextPage}
        loadMoreRef={loadMoreRef}
        onReviewLikeToggle={handleReviewLikeToggle}
        renderActions={(review) => (
          <>
            <ReviewCard.Share
              album={{ artist: albumArtist, id: album.id, title: album.title }}
              rating={review.rating}
              reviewBody={review.review}
              reviewCode={review.shareCode}
              userDisplayName={review.user.displayUsername}
            />
            <ReviewManagementMenu
              canDeleteAsAdmin={isAdmin && adminModeEnabled && !review.canDelete}
              canDeleteOwnReview={review.canDelete}
              isDeleting={deletingReviewId === review.id}
              onDelete={() => handleReviewDelete(review.id)}
            />
          </>
        )}
        resolveUser={(review) => review.user}
        reviews={reviews}
        showAlbum={false}
        viewer={viewer}
      />
    </section>
  );
}
