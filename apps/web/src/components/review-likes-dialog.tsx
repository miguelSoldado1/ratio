import { useServerFn } from "@tanstack/react-start";
import { FollowableUserListDialog } from "@/components/followable-user-list-dialog";
import { reviewQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getReviewLikes } from "@/server/functions/review-functions";

interface ViewerState {
  hasSession: boolean;
  userId?: string;
}

interface ReviewLikesDialogProps {
  onOpenChange: (open: boolean) => void;
  reviewId?: string;
  viewer: ViewerState;
}

export function ReviewLikesDialog({ onOpenChange, reviewId, viewer }: ReviewLikesDialogProps) {
  const selectedReviewId = reviewId ?? "";
  const getReviewLikesFn = useServerFn(getReviewLikes);

  return (
    <FollowableUserListDialog
      description="People who liked this review."
      getInvalidationKeys={(user) => [userQueryKeys.profile(user.username, viewer.userId)]}
      getPage={(cursor) => getReviewLikesFn({ data: { cursor: cursor ?? undefined, reviewId: selectedReviewId } })}
      onOpenChange={onOpenChange}
      open={Boolean(reviewId)}
      queryKey={reviewQueryKeys.likes(selectedReviewId, viewer.userId)}
      title="Likes"
      viewer={viewer}
    />
  );
}
