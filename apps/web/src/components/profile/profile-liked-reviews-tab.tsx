import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { InlineError } from "@/components/inline-error";
import {
  ProfileLikedReviewsSection,
  ProfileLikedReviewsSectionSkeleton,
} from "@/components/profile/profile-liked-reviews-section";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserLikedReviews } from "@/server/functions/review-functions";
import type { ReviewListViewer } from "@/components/review-list";
import type { UserProfile } from "@/server/services/review-service";

interface ProfileLikedReviewsTabProps {
  active: boolean;
  deletingReviewId: string | null;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  profileUser: UserProfile["user"];
  viewer: ReviewListViewer;
}

export function ProfileLikedReviewsTab({
  active,
  deletingReviewId,
  onReviewDelete,
  onReviewLikeToggle,
  profileUser,
  viewer,
}: ProfileLikedReviewsTabProps) {
  const getUserLikedReviewsFn = useServerFn(getUserLikedReviews);
  const userLikedReviewsQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getUserLikedReviewsFn({ data: { cursor: pageParam ?? undefined, userId: profileUser.id } }),
    queryKey: userQueryKeys.likedReviews(profileUser.id, viewer.userId),
  });

  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = userLikedReviewsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: active && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  const reviews = userLikedReviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [];

  if (userLikedReviewsQuery.isPending) {
    return <ProfileLikedReviewsSectionSkeleton />;
  }

  if (userLikedReviewsQuery.isError && reviews.length === 0) {
    return (
      <InlineError
        className="mt-7"
        description="Could not load liked reviews for this profile."
        title="Liked reviews unavailable"
      />
    );
  }

  return (
    <ProfileLikedReviewsSection
      deletingReviewId={deletingReviewId}
      displayName={profileUser.displayName}
      isFetchingNextPage={isFetchingNextPage}
      loadMoreRef={loadMoreRef}
      onReviewDelete={onReviewDelete}
      onReviewLikeToggle={onReviewLikeToggle}
      reviews={reviews}
      viewer={viewer}
    />
  );
}
