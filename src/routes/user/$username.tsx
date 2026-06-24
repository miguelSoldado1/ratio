import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { ProfileHeader, ProfileHeaderSkeleton } from "@/components/profile/profile-header";
import { ProfileReviewsSection, ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserProfile, getUserReviews } from "@/server/functions/review-functions";
import type { UserReviewsPage } from "@/server/services/review-service";

export const Route = createFileRoute("/user/$username")({
  component: UserPage,
});

function UserPage() {
  const { username } = Route.useParams();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const viewerUserId = session.data?.user.id;
  const hasSession = Boolean(viewerUserId);
  const profileQueryKey = userQueryKeys.profile(username, viewerUserId);
  const reviewsQueryKey = userQueryKeys.reviews(username, viewerUserId);

  const getUserProfileFn = useServerFn(getUserProfile);
  const userProfileQuery = useQuery({
    queryFn: () => getUserProfileFn({ data: { username } }),
    queryKey: profileQueryKey,
  });

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

  const handleReviewDeleted = useCallback(
    (deletedReview: { albumId: string }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: userQueryKeys.profile(username) }),
        queryClient.invalidateQueries({ queryKey: userQueryKeys.reviews(username) }),
        queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(deletedReview.albumId) }),
      ]).then(() => undefined),
    [queryClient, username]
  );
  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete({
    onDeleted: handleReviewDeleted,
  });

  const profile = userProfileQuery.data;
  const reviews = userReviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = userReviewsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (userProfileQuery.isPending || userReviewsQuery.isPending) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-375 flex-col gap-8 px-5 py-8 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
          <ProfileHeaderSkeleton />
          <ProfileReviewsSectionSkeleton className="mt-0" />
        </div>
      </main>
    );
  }

  if (userProfileQuery.isError || !profile) {
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
          canEdit={profile.canEdit}
          displayName={profile.displayName}
          reviewCount={profile.reviewCount}
          username={profile.username}
        />
        {userReviewsQuery.isError && reviews.length === 0 ? (
          <section className="mt-7 py-8">
            <p className="font-medium text-sm">Reviews unavailable</p>
            <p className="mt-1 max-w-md text-muted-foreground text-sm">Could not load reviews for this profile.</p>
          </section>
        ) : (
          <ProfileReviewsSection
            deletingReviewId={deletingReviewId}
            displayName={profile.displayName}
            hasSession={hasSession}
            isFetchingNextPage={isFetchingNextPage}
            loadMoreRef={loadMoreRef}
            onReviewDelete={handleReviewDelete}
            onReviewLikeToggle={handleReviewLikeToggle}
            reviews={reviews}
          />
        )}
      </div>
    </main>
  );
}
