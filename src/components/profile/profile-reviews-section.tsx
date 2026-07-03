import { Pin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileReviewManagementMenu } from "@/components/profile/profile-review-management-menu";
import { ReviewCard } from "@/components/review-card";
import { ReviewCardSkeleton } from "@/components/review-card-skeleton";
import { ReviewLikesDialog } from "@/components/review-likes-dialog";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { cn } from "@/lib/utils";
import { tryCatch } from "@/try-catch";
import type { RefObject } from "react";
import type { UserProfile, UserReviewsPage } from "@/server/services/review-service";

type ProfileReview = UserReviewsPage["reviews"][number];
type ProfileUser = UserProfile["user"];

interface ProfileReviewsSectionProps {
  deletingReviewId: string | null;
  displayName: string;
  isFetchingNextPage: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  onReviewDelete: (reviewId: string) => Promise<boolean>;
  onReviewLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  onReviewPin: (reviewId: string) => Promise<void>;
  onReviewUnpin: (reviewId: string) => Promise<void>;
  profileUser: ProfileUser;
  reviews: ProfileReview[];
  viewer: {
    hasSession: boolean;
    userId?: string;
  };
}

export function ProfileReviewsSection({
  deletingReviewId,
  displayName,
  isFetchingNextPage,
  loadMoreRef,
  onReviewDelete,
  onReviewLikeToggle,
  onReviewPin,
  onReviewUnpin,
  profileUser,
  reviews,
  viewer,
}: ProfileReviewsSectionProps) {
  const [likesReviewId, setLikesReviewId] = useState<string>();
  const [pinningReviewId, setPinningReviewId] = useState<string | null>(null);
  const { adminModeEnabled, isAdmin } = useAdminMode();

  const pinnedReviewCount = reviews.filter((review) => review.pinned).length;

  async function handlePinToggle(review: ProfileReview) {
    setPinningReviewId(review.id);

    const { error } = await tryCatch(review.pinned ? onReviewUnpin(review.id) : onReviewPin(review.id));

    setPinningReviewId(null);

    if (error) {
      toast.error("Error", {
        description: error instanceof Error ? error.message : "Could not update pinned review",
      });
    }
  }

  return (
    <>
      <section className="mt-7">
        {reviews.length === 0 ? (
          <EmptyReviews displayName={displayName} />
        ) : (
          <>
            {reviews.map((review) => (
              <ReviewCard.Root className="border-border/80" key={review.id}>
                <ReviewCard.Header
                  createdAt={review.createdAt}
                  meta={review.pinned && <ProfileReviewPinnedBadge />}
                  user={{
                    avatarUrl: profileUser.avatarUrl,
                    displayUsername: profileUser.displayUsername,
                  }}
                />
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
                    userDisplayName={profileUser.displayUsername}
                  />
                  <ProfileReviewManagementMenu
                    canAdminDelete={isAdmin && adminModeEnabled && !review.canDelete}
                    canManageOwnReview={review.canDelete}
                    isDeleting={deletingReviewId === review.id}
                    isPinning={pinningReviewId === review.id}
                    onDelete={() => onReviewDelete(review.id)}
                    onPinToggle={() => handlePinToggle(review)}
                    pinDisabled={!review.pinned && pinnedReviewCount >= 3}
                    pinned={review.pinned}
                  />
                </ReviewCard.Footer>
              </ReviewCard.Root>
            ))}
            <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
            {isFetchingNextPage ? <ProfileReviewsSectionSkeleton className="mt-0" count={2} /> : null}
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

function ProfileReviewPinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground/80 text-xs">
      <Pin className="size-3" />
      Pinned
    </span>
  );
}
