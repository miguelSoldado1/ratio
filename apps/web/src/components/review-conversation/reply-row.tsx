import { ReviewCard } from "@/components/review-card";
import { ReplyLikeButton } from "./reply-like-button";
import { ReplyManagementMenu } from "./reply-management-menu";
import type { OptimisticLikeToggleHandler } from "@/hooks/use-debounced-optimistic-like";
import type { ReviewReply } from "@/lib/tanstack-query/review-reply-cache";

interface ReplyRowProps {
  articleRef?: (node: HTMLElement | null) => void;
  canDeleteAsAdmin: boolean;
  hasSession: boolean;
  isDeleting: boolean;
  onDelete: () => Promise<boolean>;
  onLikeToggle: OptimisticLikeToggleHandler;
  onShowLikes: () => void;
  reply: ReviewReply;
}

/** A reply rendered as the shared review card without album or rating data,
 * while retaining reply-specific like and management controls. */
export function ReplyRow({
  articleRef,
  canDeleteAsAdmin,
  hasSession,
  isDeleting,
  onDelete,
  onLikeToggle,
  onShowLikes,
  reply,
}: ReplyRowProps) {
  const authorName = reply.user.displayUsername ?? reply.user.username;

  return (
    <ReviewCard.Root className="border-0 outline-none" ref={articleRef} tabIndex={-1}>
      <ReviewCard.Header
        createdAt={reply.createdAt}
        user={{
          avatarUrl: reply.user.avatarUrl ?? undefined,
          displayUsername: authorName,
          username: reply.user.username,
        }}
      />
      <ReviewCard.Review collapsed={false}>{reply.body}</ReviewCard.Review>
      <ReviewCard.Footer>
        <ReplyLikeButton
          authorName={authorName}
          disabled={!hasSession}
          liked={reply.liked}
          likes={reply.likes}
          onShowLikes={onShowLikes}
          onToggle={onLikeToggle}
        />
        <div className="ml-auto">
          <ReplyManagementMenu
            canDeleteAsAdmin={canDeleteAsAdmin}
            canDeleteOwnReply={reply.canDelete}
            isDeleting={isDeleting}
            onDelete={onDelete}
          />
        </div>
      </ReviewCard.Footer>
    </ReviewCard.Root>
  );
}
