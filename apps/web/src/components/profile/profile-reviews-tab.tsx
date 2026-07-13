import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { InlineError } from "@/components/inline-error";
import { ProfileReviewsSection, ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserReviews, pinProfileReview, unpinProfileReview } from "@/server/functions/review-functions";
import type { ReviewListViewer } from "@/components/review-list";
import type { UserProfile } from "@/server/services/review-service";

interface ProfileReviewsTabProps {
  active: boolean;
  deletingReviewId: string | null;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  profileUser: UserProfile["user"];
  viewer: ReviewListViewer;
}

export function ProfileReviewsTab({
  active,
  deletingReviewId,
  onReviewDelete,
  onReviewLikeToggle,
  profileUser,
  viewer,
}: ProfileReviewsTabProps) {
  const queryClient = useQueryClient();
  const reviewsQueryKey = userQueryKeys.reviews(profileUser.id, viewer.userId);

  const getUserReviewsFn = useServerFn(getUserReviews);
  const userReviewsQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getUserReviewsFn({ data: { cursor: pageParam ?? undefined, userId: profileUser.id } }),
    queryKey: reviewsQueryKey,
  });

  const pinProfileReviewFn = useServerFn(pinProfileReview);
  const pinProfileReviewMutation = useMutation({ mutationFn: pinProfileReviewFn });

  const unpinProfileReviewFn = useServerFn(unpinProfileReview);
  const unpinProfileReviewMutation = useMutation({ mutationFn: unpinProfileReviewFn });

  const reviews = userReviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = userReviewsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: active && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  async function handlePinReview(reviewId: string) {
    await pinProfileReviewMutation.mutateAsync({ data: { reviewId } });
    await queryClient.invalidateQueries({ queryKey: reviewsQueryKey });
  }

  async function handleUnpinReview(reviewId: string) {
    await unpinProfileReviewMutation.mutateAsync({ data: { reviewId } });
    await queryClient.invalidateQueries({ queryKey: reviewsQueryKey });
  }

  if (userReviewsQuery.isPending) {
    return <ProfileReviewsSectionSkeleton />;
  }

  if (userReviewsQuery.isError && reviews.length === 0) {
    return (
      <InlineError
        className="mt-7"
        description="Could not load reviews for this profile."
        title="Reviews unavailable"
      />
    );
  }

  return (
    <ProfileReviewsSection
      deletingReviewId={deletingReviewId}
      displayName={profileUser.displayName}
      isFetchingNextPage={isFetchingNextPage}
      loadMoreRef={loadMoreRef}
      onReviewDelete={onReviewDelete}
      onReviewLikeToggle={onReviewLikeToggle}
      onReviewPin={handlePinReview}
      onReviewUnpin={handleUnpinReview}
      profileUser={profileUser}
      reviews={reviews}
      viewer={viewer}
    />
  );
}
