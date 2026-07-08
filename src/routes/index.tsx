import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import { FeedReviewsSection, FeedReviewsSectionSkeleton } from "@/components/feed/feed-reviews-section";
import { InlineError } from "@/components/inline-error";
import { PageContainer } from "@/components/page-container";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { createCanonicalLink, createJsonLdScript, createSeoMeta, getCanonicalUrl, siteName } from "@/lib/seo";
import { albumQueryKeys, feedQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getFeed } from "@/server/functions/feed-functions";
import type { FeedPage as FeedPageData } from "@/server/services/feed-service";

export const Route = createFileRoute("/")({
  component: FeedPage,
  head: () => ({
    links: [createCanonicalLink("/")],
    meta: createSeoMeta({ path: "/" }),
    scripts: [
      createJsonLdScript({
        "@context": "https://schema.org",
        "@type": "WebSite",
        description: "Discover, rate, and review albums with a social music community.",
        name: siteName,
        url: getCanonicalUrl("/"),
      }),
    ],
  }),
});

function FeedPage() {
  const queryClient = useQueryClient();
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
    queryKeys: [feedQueryKey],
  });

  const handleReviewDeleted = useCallback(
    async (deletedReview: { albumId: string }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(deletedReview.albumId) }),
      ]);
    },
    [feedQueryKey, queryClient]
  );

  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete({
    onDeleted: handleReviewDeleted,
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
        <PageContainer className="flex flex-col pt-0 pb-8 lg:pb-12">
          <h1 className="sr-only">Album reviews feed</h1>
          <FeedReviewsSectionSkeleton className="mt-0" />
        </PageContainer>
      </main>
    );
  }

  if (feedQuery.isError && reviews.length === 0) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer className="pt-0 pb-8 lg:pb-12">
          <h1 className="sr-only">Album reviews feed</h1>
          <InlineError className="py-5" description="Could not load reviews right now." title="Feed unavailable" />
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PageContainer className="flex flex-col pt-0 pb-8 lg:pb-12">
        <h1 className="sr-only">Album reviews feed</h1>
        <FeedReviewsSection
          className="mt-0"
          deletingReviewId={deletingReviewId}
          isFetchingNextPage={isFetchingNextPage}
          loadMoreRef={loadMoreRef}
          onReviewDelete={handleReviewDelete}
          onReviewLikeToggle={handleReviewLikeToggle}
          reviews={reviews}
          viewer={viewer}
        />
      </PageContainer>
    </main>
  );
}
