import { Pin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ProfileReviewManagementMenu } from "@/components/profile/profile-review-management-menu";
import { ReviewCard } from "@/components/review-card";
import { ReviewList, ReviewListSkeleton } from "@/components/review-list";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { tryCatch } from "@/try-catch";
import type { RefObject } from "react";
import type { ReviewListViewer } from "@/components/review-list";
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
  viewer: ReviewListViewer;
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
    <section className="mt-7">
      <ReviewList
        emptyState={<EmptyReviews displayName={displayName} />}
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
          </>
        )}
        renderMeta={(review) => (review.pinned ? <ProfileReviewPinnedBadge /> : null)}
        resolveUser={() => ({
          avatarUrl: profileUser.avatarUrl,
          displayUsername: profileUser.displayUsername,
        })}
        reviews={reviews}
        viewer={viewer}
      />
    </section>
  );
}

export function ProfileReviewsSectionSkeleton({ className, count = 3 }: { className?: string; count?: number }) {
  return <ReviewListSkeleton aria-label="Loading profile reviews" className={className} count={count} />;
}

function EmptyReviews({ displayName }: { displayName: string }) {
  return <EmptyState description={`${displayName} has not reviewed any albums yet.`} title="No reviews yet" />;
}

function ProfileReviewPinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground-subtle text-xs">
      <Pin className="size-3" />
      Pinned
    </span>
  );
}
