import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ProfileHeader, ProfileHeaderSkeleton } from "@/components/profile/profile-header";
import { ProfileReviewsSection, ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserReviews } from "@/server/functions/review-functions";
import type { UserReviewsPage } from "@/server/services/review-service";

export const Route = createFileRoute("/user/$username")({
  component: UserPage,
});

function UserPage() {
  const { username } = Route.useParams();
  const session = authClient.useSession();
  const viewerUserId = session.data?.user.id;
  const viewerUsername = session.data?.user.username;
  const hasSession = Boolean(viewerUserId);
  const reviewsQueryKey = userQueryKeys.reviews(username, viewerUserId);

  const getUserReviewsFn = useServerFn(getUserReviews);
  const userReviewsQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getUserReviewsFn({ data: { cursor: pageParam ?? undefined, username } }),
    queryKey: reviewsQueryKey,
  });

  const handleReviewLikeToggle = useReviewLikeToggle<UserReviewsPage>({
    enabled: hasSession,
    queryKey: reviewsQueryKey,
  });

  const firstPage = userReviewsQuery.data?.pages[0];
  const profile = firstPage?.user;
  const reviews = userReviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = userReviewsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (userReviewsQuery.isPending) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-375 flex-col gap-8 px-5 py-8 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
          <ProfileHeaderSkeleton />
          <ProfileReviewsSectionSkeleton className="mt-0" />
        </div>
      </main>
    );
  }

  if (userReviewsQuery.isError || !profile) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto w-full max-w-375 px-5 py-12 lg:px-10 xl:px-14 2xl:px-20">
          <p className="font-medium text-sm">User unavailable</p>
          <p className="mt-1 max-w-md text-muted-foreground text-sm">Could not load this profile.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-375 flex-col px-5 py-8 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
        <ProfileHeader
          avatarUrl={profile.avatarUrl}
          canEdit={viewerUsername === profile.username}
          displayName={profile.displayName}
          reviewCount={firstPage.reviewCount}
          username={profile.username}
        />
        <ProfileReviewsSection
          displayName={profile.displayName}
          hasSession={hasSession}
          isFetchingNextPage={isFetchingNextPage}
          loadMoreRef={loadMoreRef}
          onReviewLikeToggle={handleReviewLikeToggle}
          reviews={reviews}
        />
      </div>
    </main>
  );
}
