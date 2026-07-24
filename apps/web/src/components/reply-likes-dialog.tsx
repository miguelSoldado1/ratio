import { useServerFn } from "@tanstack/react-start";
import { FollowableUserListDialog } from "@/components/followable-user-list-dialog";
import { reviewQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getReviewReplyLikes } from "@/server/functions/review-reply-functions";

interface ViewerState {
  hasSession: boolean;
  userId?: string;
}

interface ReplyLikesDialogProps {
  onOpenChange: (open: boolean) => void;
  replyId?: string;
  viewer: ViewerState;
}

export function ReplyLikesDialog({ onOpenChange, replyId, viewer }: ReplyLikesDialogProps) {
  const selectedReplyId = replyId ?? "";
  const getReviewReplyLikesFn = useServerFn(getReviewReplyLikes);

  return (
    <FollowableUserListDialog
      description="People who liked this reply."
      getInvalidationKeys={(user) => [userQueryKeys.profile(user.username, viewer.userId)]}
      getPage={(cursor) => getReviewReplyLikesFn({ data: { cursor: cursor ?? undefined, replyId: selectedReplyId } })}
      onOpenChange={onOpenChange}
      open={Boolean(replyId)}
      queryKey={reviewQueryKeys.replyLikes(selectedReplyId, viewer.userId)}
      title="Likes"
      viewer={viewer}
    />
  );
}
