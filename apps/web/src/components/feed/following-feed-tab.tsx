import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState } from "@/components/empty-state";
import { FeedReviewsSection, FeedReviewsSectionSkeleton } from "@/components/feed/feed-reviews-section";
import { InlineError } from "@/components/inline-error";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { feedQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getFollowingFeed } from "@/server/functions/feed-functions";
import type { ReviewListViewer } from "@/components/review-list";

interface FollowingFeedTabProps {
  active: boolean;
  deletingReviewId: string | null;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  viewer: ReviewListViewer;
}

export function FollowingFeedTab({
  active,
  deletingReviewId,
  onReviewDelete,
  onReviewLikeToggle,
  viewer,
}: FollowingFeedTabProps) {
  const getFollowingFeedFn = useServerFn(getFollowingFeed);
  const followingFeedQuery = useInfiniteQuery({
    enabled: viewer.hasSession,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getFollowingFeedFn({ data: { cursor: pageParam ?? undefined } }),
    queryKey: feedQueryKeys.following(viewer.userId ?? ""),
  });

  const reviews = followingFeedQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = followingFeedQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: active && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (followingFeedQuery.isPending) {
    return <FeedReviewsSectionSkeleton className="mt-0" />;
  }

  if (followingFeedQuery.isError && reviews.length === 0) {
    return (
      <InlineError
        className="py-5"
        description="Could not load reviews from people you follow."
        title="Following feed unavailable"
      />
    );
  }

  return (
    <FeedReviewsSection
      className="mt-0"
      deletingReviewId={deletingReviewId}
      emptyState={
        <EmptyState
          description="New reviews from people you follow will appear here."
          title="No following reviews yet"
        />
      }
      isFetchingNextPage={isFetchingNextPage}
      loadMoreRef={loadMoreRef}
      onReviewDelete={onReviewDelete}
      onReviewLikeToggle={onReviewLikeToggle}
      reviews={reviews}
      viewer={viewer}
    />
  );
}
