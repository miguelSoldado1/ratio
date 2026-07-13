import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FeedReviewsSection, FeedReviewsSectionSkeleton } from "@/components/feed/feed-reviews-section";
import { InlineError } from "@/components/inline-error";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { feedQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getFeed } from "@/server/functions/feed-functions";
import type { ReviewListViewer } from "@/components/review-list";

interface ForYouFeedTabProps {
  active: boolean;
  deletingReviewId: string | null;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  viewer: ReviewListViewer;
}

export function ForYouFeedTab({
  active,
  deletingReviewId,
  onReviewDelete,
  onReviewLikeToggle,
  viewer,
}: ForYouFeedTabProps) {
  const getFeedFn = useServerFn(getFeed);
  const feedQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) => getFeedFn({ data: { cursor: pageParam ?? undefined } }),
    queryKey: feedQueryKeys.root(viewer.userId),
  });

  const reviews = feedQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = feedQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: active && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (feedQuery.isPending) {
    return <FeedReviewsSectionSkeleton className="mt-0" />;
  }

  if (feedQuery.isError && reviews.length === 0) {
    return <InlineError className="py-5" description="Could not load reviews right now." title="Feed unavailable" />;
  }

  return (
    <FeedReviewsSection
      className="mt-0"
      deletingReviewId={deletingReviewId}
      isFetchingNextPage={isFetchingNextPage}
      loadMoreRef={loadMoreRef}
      onReviewDelete={onReviewDelete}
      onReviewLikeToggle={onReviewLikeToggle}
      reviews={reviews}
      viewer={viewer}
    />
  );
}
