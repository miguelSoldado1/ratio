import { DeleteReviewDialog } from "@/components/delete-review-dialog";
import { ReviewCard } from "@/components/review-card";
import { ReviewCardSkeleton } from "@/components/review-card-skeleton";
import { cn } from "@/lib/utils";
import type { RefObject } from "react";
import type { UserProfile, UserReviewsPage } from "@/server/services/review-service";

type ProfileReview = UserReviewsPage["reviews"][number];
type ProfileUser = UserProfile["user"];

interface ProfileReviewsSectionProps {
  deletingReviewId: string | null;
  displayName: string;
  hasSession: boolean;
  isFetchingNextPage: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  profileUser: ProfileUser;
  reviews: ProfileReview[];
}

export function ProfileReviewsSection({
  deletingReviewId,
  displayName,
  hasSession,
  isFetchingNextPage,
  loadMoreRef,
  onReviewDelete,
  onReviewLikeToggle,
  profileUser,
  reviews,
}: ProfileReviewsSectionProps) {
  return (
    <section className="mt-7">
      {reviews.length === 0 ? (
        <EmptyReviews displayName={displayName} />
      ) : (
        <>
          {reviews.map((review) => (
            <ReviewCard.Root className="border-border/80" key={review.id}>
              <ReviewCard.Header
                createdAt={review.createdAt}
                user={{
                  avatarUrl: profileUser.avatarUrl,
                  displayUsername: profileUser.displayUsername,
                }}
              />
              <div className="flex items-start gap-3">
                <ReviewCard.Album album={review.album} className="flex-1" href={`/album/${review.album.id}`} />
                <ReviewCard.Rating value={review.rating} />
              </div>
              {review.review ? <ReviewCard.Review>{review.review}</ReviewCard.Review> : null}
              <ReviewCard.Footer>
                <ReviewCard.Likes
                  count={review.likes}
                  disabled={!hasSession}
                  liked={review.liked}
                  onToggle={hasSession ? (liked) => onReviewLikeToggle(review.id, liked) : undefined}
                />
                {review.canDelete ? (
                  <DeleteReviewDialog
                    className="-mr-2 ml-auto"
                    isDeleting={deletingReviewId === review.id}
                    onDelete={() => onReviewDelete(review.id)}
                  />
                ) : null}
              </ReviewCard.Footer>
            </ReviewCard.Root>
          ))}
          <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
          {isFetchingNextPage ? <ProfileReviewsSectionSkeleton className="mt-0" count={2} /> : null}
        </>
      )}
    </section>
  );
}

export function ProfileReviewsSectionSkeleton({ className, count = 3 }: { className?: string; count?: number }) {
  return (
    <section aria-label="Loading profile reviews" className={cn("mt-7", className)}>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <ProfileReviewSkeleton key={index} />
      ))}
    </section>
  );
}

function ProfileReviewSkeleton() {
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

function EmptyReviews({ displayName }: { displayName: string }) {
  return (
    <div className="py-8">
      <p className="font-medium text-sm">No reviews yet</p>
      <p className="mt-1 max-w-md text-muted-foreground text-sm">{displayName} has not reviewed any albums yet.</p>
    </div>
  );
}
