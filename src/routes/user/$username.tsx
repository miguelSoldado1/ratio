import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { InlineError } from "@/components/inline-error";
import { ProfileHeader, ProfileHeaderSkeleton } from "@/components/profile/profile-header";
import { ProfileReviewsSection, ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";
import { albumQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import {
  getUserProfile,
  getUserReviews,
  pinProfileReview,
  unpinProfileReview,
} from "@/server/functions/review-functions";
import type { UserReviewsPage } from "@/server/services/review-service";

export const Route = createFileRoute("/user/$username")({
  component: UserPage,
  head: ({ params }) => {
    const path = `/user/${params.username}`;

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description: `Read @${params.username}'s album reviews on Ratio.`,
        path,
        title: `@${params.username} - Album Reviews | ${siteName}`,
        type: "profile",
      }),
    };
  },
});

function UserPage() {
  const { username } = Route.useParams();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const viewerUserId = session.data?.user.id;
  const hasSession = Boolean(viewerUserId);
  const profileQueryKey = userQueryKeys.profile(username, viewerUserId);

  const viewer = useMemo(() => ({ hasSession, userId: viewerUserId }), [hasSession, viewerUserId]);

  const getUserProfileFn = useServerFn(getUserProfile);
  const userProfileQuery = useQuery({
    queryFn: () => getUserProfileFn({ data: { username } }),
    queryKey: profileQueryKey,
  });

  const profile = userProfileQuery.data?.user;
  const reviewsQueryKey = profile
    ? userQueryKeys.reviews(profile.id, viewerUserId)
    : userQueryKeys.reviews("", viewerUserId);

  const pinProfileReviewFn = useServerFn(pinProfileReview);
  const pinProfileReviewMutation = useMutation({ mutationFn: pinProfileReviewFn });

  const unpinProfileReviewFn = useServerFn(unpinProfileReview);
  const unpinProfileReviewMutation = useMutation({ mutationFn: unpinProfileReviewFn });

  const getUserReviewsFn = useServerFn(getUserReviews);
  const userReviewsQuery = useInfiniteQuery({
    enabled: Boolean(profile),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getUserReviewsFn({ data: { cursor: pageParam ?? undefined, userId: profile?.id ?? "" } }),
    queryKey: reviewsQueryKey,
  });

  const handleReviewLikeToggle = useReviewLikeToggle<UserReviewsPage>({
    enabled: hasSession,
    queryKeys: [reviewsQueryKey],
  });

  async function handleReviewDeleted(deletedReview: { albumId: string }) {
    const staleQueryKeys = [
      userQueryKeys.profile(username),
      userQueryKeys.reviews(profile?.id ?? ""),
      albumQueryKeys.review(deletedReview.albumId),
    ];

    await Promise.all(
      staleQueryKeys.map((staleQueryKey) => queryClient.invalidateQueries({ queryKey: staleQueryKey }))
    );
  }

  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete({
    onDeleted: handleReviewDeleted,
  });

  async function handlePinReview(reviewId: string) {
    await pinProfileReviewMutation.mutateAsync({ data: { reviewId } });
    await queryClient.invalidateQueries({ queryKey: reviewsQueryKey });
  }

  async function handleUnpinReview(reviewId: string) {
    await unpinProfileReviewMutation.mutateAsync({ data: { reviewId } });
    await queryClient.invalidateQueries({ queryKey: reviewsQueryKey });
  }

  const reviews = userReviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = userReviewsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (userProfileQuery.isPending || (profile && userReviewsQuery.isPending)) {
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
          <InlineError description="Could not load this profile." title="User unavailable" />
        </div>
      </main>
    );
  }

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex w-full max-w-375 flex-col px-5 py-8 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
          <ProfileHeader
            onAuthRequired={() => setAuthDialogOpen(true)}
            profile={profile}
            stats={{
              followersCount: userProfileQuery.data.followersCount,
              followingCount: userProfileQuery.data.followingCount,
              reviewCount: userProfileQuery.data.reviewCount,
            }}
            viewer={viewer}
          />
          {userReviewsQuery.isError && reviews.length === 0 ? (
            <InlineError
              className="mt-7"
              description="Could not load reviews for this profile."
              title="Reviews unavailable"
            />
          ) : (
            <ProfileReviewsSection
              deletingReviewId={deletingReviewId}
              displayName={profile.displayName}
              isFetchingNextPage={isFetchingNextPage}
              loadMoreRef={loadMoreRef}
              onReviewDelete={handleReviewDelete}
              onReviewLikeToggle={handleReviewLikeToggle}
              onReviewPin={handlePinReview}
              onReviewUnpin={handleUnpinReview}
              profileUser={profile}
              reviews={reviews}
              viewer={viewer}
            />
          )}
        </div>
      </main>
    </>
  );
}
