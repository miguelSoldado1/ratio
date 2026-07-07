import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ReviewCard } from "@/components/review-card";
import { ReviewCardSkeleton } from "@/components/review-card-skeleton";
import { ReviewLikesDialog } from "@/components/review-likes-dialog";
import { ReviewManagementMenu } from "@/components/review-management-menu";
import { Spinner } from "@/components/ui/spinner";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { cn } from "@/lib/utils";
import type { RefObject } from "react";
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
  viewer: {
    hasSession: boolean;
    userId?: string;
  };
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
  const [likesReviewId, setLikesReviewId] = useState<string>();
  const { adminModeEnabled, isAdmin } = useAdminMode();

  return (
    <>
      <section className={cn("mt-7", className)}>
        {reviews.length === 0 ? (
          <EmptyFeed />
        ) : (
          <>
            {reviews.map((review) => (
              <ReviewCard.Root className="border-border/80" key={review.id}>
                <ReviewCard.Header createdAt={review.createdAt} user={review.user} />
                <div className="flex items-start gap-3">
                  <ReviewCard.Album album={review.album} className="flex-1" linked />
                  <ReviewCard.Rating value={review.rating} />
                </div>
                {review.review ? <ReviewCard.Review>{review.review}</ReviewCard.Review> : null}
                <ReviewCard.Footer>
                  <ReviewCard.Likes
                    count={review.likes}
                    disabled={!viewer.hasSession}
                    liked={review.liked}
                    onShowLikes={() => setLikesReviewId(review.id)}
                    onToggle={viewer.hasSession ? (liked) => onReviewLikeToggle(review.id, liked) : undefined}
                  />
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
                </ReviewCard.Footer>
              </ReviewCard.Root>
            ))}
            <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
            {isFetchingNextPage ? <LoadingMoreReviews /> : null}
          </>
        )}
      </section>
      <ReviewLikesDialog
        onOpenChange={(open) => {
          if (!open) setLikesReviewId(undefined);
        }}
        open={Boolean(likesReviewId)}
        reviewId={likesReviewId}
        viewer={viewer}
      />
    </>
  );
}

export function FeedReviewsSectionSkeleton({ className, count = 3 }: { className?: string; count?: number }) {
  return (
    <section aria-label="Loading feed reviews" className={cn("mt-7", className)}>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <FeedReviewSkeleton key={index} />
      ))}
    </section>
  );
}

function FeedReviewSkeleton() {
  return (
    <ReviewCardSkeleton.Root>
      <ReviewCardSkeleton.Header />
      <div className="flex items-start gap-3">
        <ReviewCardSkeleton.Album />
        <ReviewCardSkeleton.Rating />
      </div>
      <ReviewCardSkeleton.Review />
      <ReviewCardSkeleton.Footer />
    </ReviewCardSkeleton.Root>
  );
}

function LoadingMoreReviews() {
  return (
    <div className="flex justify-center border-border/80 border-t py-6">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

function EmptyFeed() {
  return <EmptyState description="Reviews will appear here once people start rating albums." title="No reviews yet" />;
}
