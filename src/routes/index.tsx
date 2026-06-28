import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { FeedReviewsSection, FeedReviewsSectionSkeleton } from "@/components/feed/feed-reviews-section";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { feedQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getFeed } from "@/server/functions/feed-functions";
import type { FeedPage as FeedPageData } from "@/server/services/feed-service";

export const Route = createFileRoute("/")({ component: FeedPage });

function FeedPage() {
  const session = authClient.useSession();
  const viewerUserId = session.data?.user.id;
  const hasSession = Boolean(viewerUserId);
  const viewer = useMemo(() => ({ hasSession, userId: viewerUserId }), [hasSession, viewerUserId]);
  const feedQueryKey = feedQueryKeys.root(viewerUserId);

  const getFeedFn = useServerFn(getFeed);
  const feedQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) => getFeedFn({ data: { cursor: pageParam ?? undefined } }),
    queryKey: feedQueryKey,
  });

  const handleReviewLikeToggle = useReviewLikeToggle<FeedPageData>({
    enabled: hasSession,
    queryKey: feedQueryKey,
  });

  const reviews = feedQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = feedQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (feedQuery.isPending) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-375 flex-col px-5 pt-0 pb-8 lg:px-10 lg:pb-12 xl:px-14 2xl:px-20">
          <FeedReviewsSectionSkeleton className="mt-0" />
        </div>
      </main>
    );
  }

  if (feedQuery.isError && reviews.length === 0) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto w-full max-w-375 px-5 pt-0 pb-8 lg:px-10 lg:pb-12 xl:px-14 2xl:px-20">
          <section className="py-5">
            <p className="font-medium text-sm">Feed unavailable</p>
            <p className="mt-1 max-w-md text-muted-foreground text-sm">Could not load reviews right now.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-375 flex-col px-5 pt-0 pb-8 lg:px-10 lg:pb-12 xl:px-14 2xl:px-20">
        <FeedReviewsSection
          className="mt-0"
          isFetchingNextPage={isFetchingNextPage}
          loadMoreRef={loadMoreRef}
          onReviewLikeToggle={handleReviewLikeToggle}
          reviews={reviews}
          viewer={viewer}
        />
      </div>
    </main>
  );
}
