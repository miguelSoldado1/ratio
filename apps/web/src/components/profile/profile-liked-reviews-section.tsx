import { EmptyState } from "@/components/empty-state";
import { ReviewCard } from "@/components/review-card";
import { ReviewList, ReviewListSkeleton } from "@/components/review-list";
import { ReviewManagementMenu } from "@/components/review-management-menu";
import { useAdminMode } from "@/hooks/use-admin-mode";
import type { RefObject } from "react";
import type { ReviewListViewer } from "@/components/review-list";
import type { UserLikedReviewsPage } from "@/server/services/review-service";

type ProfileLikedReview = UserLikedReviewsPage["reviews"][number];

interface ProfileLikedReviewsSectionProps {
  deletingReviewId: string | null;
  displayName: string;
  isFetchingNextPage: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  reviews: ProfileLikedReview[];
  viewer: ReviewListViewer;
}

export function ProfileLikedReviewsSection({
  deletingReviewId,
  displayName,
  isFetchingNextPage,
  loadMoreRef,
  onReviewDelete,
  onReviewLikeToggle,
  reviews,
  viewer,
}: ProfileLikedReviewsSectionProps) {
  const { adminModeEnabled, isAdmin } = useAdminMode();

  return (
    <section className="bg-background pt-7">
      <ReviewList
        emptyState={<EmptyLikedReviews displayName={displayName} />}
        isFetchingNextPage={isFetchingNextPage}
        loadMoreRef={loadMoreRef}
        onReviewLikeToggle={onReviewLikeToggle}
        renderActions={(review) => (
          <>
            <ReviewCard.Share
              album={review.album}
              rating={review.rating}
              reviewBody={review.review}
              reviewId={review.id}
              userDisplayName={review.user.displayUsername}
            />
            <ReviewManagementMenu
              canDeleteAsAdmin={isAdmin && adminModeEnabled && !review.canDelete}
              canDeleteOwnReview={review.canDelete}
              isDeleting={deletingReviewId === review.id}
              onDelete={() => onReviewDelete(review.id)}
            />
          </>
        )}
        renderReplies={(review) => (
          <ReviewCard.Replies
            replyCount={review.replyCount}
            reviewAuthorName={review.user.displayUsername}
            reviewId={review.id}
          />
        )}
        resolvePermalink={(review) => ({
          reviewAuthorName: review.user.displayUsername,
          reviewId: review.id,
        })}
        resolveUser={(review) => review.user}
        reviews={reviews}
        viewer={viewer}
      />
    </section>
  );
}

export function ProfileLikedReviewsSectionSkeleton({ count = 3 }: { count?: number }) {
  return <ReviewListSkeleton aria-label="Loading liked reviews" count={count} />;
}

function EmptyLikedReviews({ displayName }: { displayName: string }) {
  return <EmptyState description={`${displayName} has not liked any reviews yet.`} title="No liked reviews yet" />;
}
