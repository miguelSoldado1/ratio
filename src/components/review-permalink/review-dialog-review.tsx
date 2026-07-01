import { ReviewCard } from "@/components/review-card";
import { ReviewManagementMenu } from "@/components/review-management-menu";
import type { ReviewAlbum, ReviewUser } from "@/components/review-card";

export interface DialogReview {
  album: ReviewAlbum;
  canDelete: boolean;
  createdAt: Date;
  id: string;
  liked: boolean;
  likes: number;
  rating: number;
  review?: string;
  user: ReviewUser;
}

interface ReviewDialogReviewProps {
  adminModeEnabled: boolean;
  deletingReviewId: string | null;
  hasSession: boolean;
  isAdmin: boolean;
  onDelete: (reviewId: string) => Promise<boolean>;
  onLikeToggle: (reviewId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  onShowLikes: () => void;
  review: DialogReview;
}

export function ReviewDialogReview({
  adminModeEnabled,
  deletingReviewId,
  hasSession,
  isAdmin,
  onDelete,
  onLikeToggle,
  onShowLikes,
  review,
}: ReviewDialogReviewProps) {
  return (
    <ReviewCard.Root className="border-0 py-0">
      <ReviewCard.Header createdAt={review.createdAt} user={review.user} />
      <div className="flex items-start gap-3">
        <ReviewCard.Album album={review.album} className="flex-1" linked />
        <ReviewCard.Rating value={review.rating} />
      </div>
      {review.review ? <ReviewCard.Review collapsed={false}>{review.review}</ReviewCard.Review> : null}
      <ReviewCard.Footer>
        <ReviewCard.Likes
          count={review.likes}
          disabled={!hasSession}
          liked={review.liked}
          onShowLikes={onShowLikes}
          onToggle={hasSession ? (liked) => onLikeToggle(review.id, liked) : undefined}
        />
        <ReviewManagementMenu
          canDeleteAsAdmin={isAdmin && adminModeEnabled && !review.canDelete}
          canDeleteOwnReview={review.canDelete}
          isDeleting={deletingReviewId === review.id}
          onDelete={() => onDelete(review.id)}
        />
      </ReviewCard.Footer>
    </ReviewCard.Root>
  );
}
