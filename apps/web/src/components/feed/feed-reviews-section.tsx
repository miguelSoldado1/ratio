import { EmptyState } from "@/components/empty-state";
import { ReviewCard } from "@/components/review-card";
import { ReviewList, ReviewListSkeleton } from "@/components/review-list";
import { ReviewManagementMenu } from "@/components/review-management-menu";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { cn } from "@/lib/utils";
import type { RefObject } from "react";
import type { ReviewListViewer } from "@/components/review-list";
import type { FeedPage } from "@/server/services/feed-service";

type FeedReview = FeedPage["reviews"][number];

interface FeedReviewsSectionProps {
  className?: string;
  deletingReviewId: string | null;
  isFetchingNextPage: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  reviews: FeedReview[];
  viewer: ReviewListViewer;
}

export function FeedReviewsSection({
  className,
  deletingReviewId,
  isFetchingNextPage,
  loadMoreRef,
  onReviewDelete,
  onReviewLikeToggle,
  reviews,
  viewer,
}: FeedReviewsSectionProps) {
  const { adminModeEnabled, isAdmin } = useAdminMode();

  return (
    <section className={cn("mt-7", className)}>
      <ReviewList
        emptyState={<EmptyFeed />}
        isFetchingNextPage={isFetchingNextPage}
        loadMoreRef={loadMoreRef}
        onReviewLikeToggle={onReviewLikeToggle}
        renderActions={(review) => (
          <>
            <ReviewCard.Share
              album={review.album}
              rating={review.rating}
              reviewBody={review.review}
              reviewCode={review.shareCode}
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
        resolveUser={(review) => review.user}
        reviews={reviews}
        viewer={viewer}
      />
    </section>
  );
}

export function FeedReviewsSectionSkeleton({ className, count = 3 }: { className?: string; count?: number }) {
  return <ReviewListSkeleton aria-label="Loading feed reviews" className={className} count={count} />;
}

function EmptyFeed() {
  return <EmptyState description="Reviews will appear here once people start rating albums." title="No reviews yet" />;
}
