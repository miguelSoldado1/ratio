import { useState } from "react";
import { ReviewCard } from "@/components/review-card";
import { ReviewCardSkeleton } from "@/components/review-card-skeleton";
import { ReviewLikesDialog } from "@/components/review-likes-dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ReactNode, RefObject } from "react";
import type { ReviewAlbum, ReviewPermalink, ReviewUser } from "@/components/review-card";

export interface ReviewListViewer {
  hasSession: boolean;
  userId?: string;
}

export type ReviewLikeToggleHandler = (
  reviewId: string,
  liked: boolean
) => boolean | Promise<boolean | undefined> | undefined;

/** Minimum shape a review needs to render as a row. The author is supplied by
 * `resolveUser` (the profile page derives it from the profile, not the review),
 * and site-specific fields (canDelete, pinned, …) are read inside
 * the caller-provided `renderMeta` / `renderActions` closures. */
export interface ReviewListItem {
  album?: ReviewAlbum;
  createdAt: Date;
  id: string;
  liked: boolean;
  likes: number;
  rating: number;
  review?: string;
}

interface ReviewRowProps<TReview extends ReviewListItem> {
  className?: string;
  onReviewLikeToggle: ReviewLikeToggleHandler;
  onShowLikes?: () => void;
  renderActions?: (review: TReview) => ReactNode;
  renderMeta?: (review: TReview) => ReactNode;
  renderReplies?: (review: TReview) => ReactNode;
  resolvePermalink?: (review: TReview) => ReviewPermalink;
  resolveUser: (review: TReview) => ReviewUser;
  review: TReview;
  showAlbum?: boolean;
  viewer: ReviewListViewer;
}

/** A single review row. Used directly by contexts that render one review and
 * manage their own likes dialog (e.g. the review permalink); lists compose it
 * through `ReviewList`. */
export function ReviewRow<TReview extends ReviewListItem>({
  className,
  onReviewLikeToggle,
  onShowLikes,
  renderActions,
  renderMeta,
  renderReplies,
  resolvePermalink,
  resolveUser,
  review,
  showAlbum = true,
  viewer,
}: ReviewRowProps<TReview>) {
  const permalink = resolvePermalink?.(review);

  return (
    <ReviewCard.Root className={className}>
      <ReviewCard.Header
        createdAt={review.createdAt}
        meta={renderMeta?.(review)}
        permalink={permalink}
        user={resolveUser(review)}
      />
      {showAlbum && review.album ? (
        <div className="flex items-start gap-3">
          <ReviewCard.Album album={review.album} className="flex-1" linked />
          <ReviewCard.Rating value={review.rating} />
        </div>
      ) : (
        <ReviewCard.Rating value={review.rating} />
      )}
      {review.review ? <ReviewCard.Review permalink={permalink}>{review.review}</ReviewCard.Review> : null}
      <ReviewCard.Footer>
        <ReviewCard.Likes
          count={review.likes}
          disabled={!viewer.hasSession}
          liked={review.liked}
          onShowLikes={onShowLikes}
          onToggle={viewer.hasSession ? (liked) => onReviewLikeToggle(review.id, liked) : undefined}
        />
        {renderReplies?.(review)}
        {renderActions?.(review)}
      </ReviewCard.Footer>
    </ReviewCard.Root>
  );
}

interface ReviewListProps<TReview extends ReviewListItem> {
  emptyState?: ReactNode;
  isFetchingNextPage?: boolean;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  onReviewLikeToggle: ReviewLikeToggleHandler;
  renderActions?: (review: TReview) => ReactNode;
  renderMeta?: (review: TReview) => ReactNode;
  renderReplies?: (review: TReview) => ReactNode;
  resolvePermalink?: (review: TReview) => ReviewPermalink;
  resolveUser: (review: TReview) => ReviewUser;
  reviews: TReview[];
  rowClassName?: string;
  showAlbum?: boolean;
  viewer: ReviewListViewer;
}

/** Renders a list of review rows plus the shared infinite-scroll sentinel,
 * loading-more indicator, and likes dialog. Presentational and controlled: the
 * caller owns the query and passes `reviews`, `loadMoreRef`, and callbacks. */
export function ReviewList<TReview extends ReviewListItem>({
  emptyState,
  isFetchingNextPage = false,
  loadMoreRef,
  onReviewLikeToggle,
  renderActions,
  renderMeta,
  renderReplies,
  resolvePermalink,
  resolveUser,
  reviews,
  rowClassName = "border-border/80",
  showAlbum = true,
  viewer,
}: ReviewListProps<TReview>) {
  const [reviewLikesId, setReviewLikesId] = useState<string>();

  if (reviews.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {reviews.map((review) => (
        <ReviewRow
          className={rowClassName}
          key={review.id}
          onReviewLikeToggle={onReviewLikeToggle}
          onShowLikes={() => setReviewLikesId(review.id)}
          renderActions={renderActions}
          renderMeta={renderMeta}
          renderReplies={renderReplies}
          resolvePermalink={resolvePermalink}
          resolveUser={resolveUser}
          review={review}
          showAlbum={showAlbum}
          viewer={viewer}
        />
      ))}
      {loadMoreRef ? <div aria-hidden="true" className="h-px" ref={loadMoreRef} /> : null}
      {isFetchingNextPage ? <LoadingMoreReviews /> : null}
      <ReviewLikesDialog
        onOpenChange={(open) => {
          if (!open) setReviewLikesId(undefined);
        }}
        reviewId={reviewLikesId}
        viewer={viewer}
      />
    </>
  );
}

function LoadingMoreReviews() {
  return (
    <div className="flex justify-center border-border/80 border-t py-6">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

/** The shared skeleton body for a single review row. */
export function ReviewSkeletonCard() {
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

interface ReviewListSkeletonProps {
  "aria-label"?: string;
  className?: string;
  count?: number;
}

/** A full section of review skeletons, used for initial and load-more states. */
export function ReviewListSkeleton({ "aria-label": ariaLabel, className, count = 3 }: ReviewListSkeletonProps) {
  return (
    <section aria-label={ariaLabel} className={cn("mt-7", className)}>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <ReviewSkeletonCard key={index} />
      ))}
    </section>
  );
}
