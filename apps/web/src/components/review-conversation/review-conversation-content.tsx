import { MessageCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ReviewCard } from "@/components/review-card";
import { ReviewManagementMenu } from "@/components/review-management-menu";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { ReplyThread } from "./reply-thread";
import type { ChangeEvent, FormEvent, RefObject } from "react";
import type { ReviewLikeToggleHandler, ReviewListViewer } from "@/components/review-list";
import type { ReviewReply } from "@/lib/tanstack-query/review-reply-cache";
import type { getReviewById } from "@/server/functions/review-functions";

type ReviewDetail = NonNullable<Awaited<ReturnType<typeof getReviewById>>>;
const maxReplyLength = 500;

function getReplyCountClassName(length: number) {
  if (length > maxReplyLength) return "mr-auto text-destructive text-xs tabular-nums";

  return length > 400 ? "mr-auto text-muted-foreground-subtle text-xs tabular-nums" : "sr-only";
}

interface ReviewConversationContentProps {
  composerUser?: {
    avatarUrl?: string;
    name: string;
  };
  deletingReplyId: string | null;
  deletingReviewId: string | null;
  hasNextReplyPage: boolean;
  isAdminMode: boolean;
  isCreatingReply: boolean;
  isFetchingNextReplyPage: boolean;
  isInitialRepliesError: boolean;
  isInitialRepliesLoading: boolean;
  isNextReplyPageError: boolean;
  loadMoreRepliesRef: RefObject<HTMLDivElement | null>;
  localReplyTail: ReviewReply[];
  onAuthRequired: () => void;
  onCreateReply: (body: string) => Promise<string | null>;
  onDeleteReply: (replyId: string) => Promise<boolean>;
  onDeleteReview: () => Promise<boolean>;
  onLikeReply: (replyId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  onRetryNextReplyPage: () => void;
  onRetryReplies: () => void;
  onReviewLikeToggle: ReviewLikeToggleHandler;
  onShowReplyLikes: (replyId: string) => void;
  onShowReviewLikes: () => void;
  replies: ReviewReply[];
  replyToRevealId?: string;
  replyTotalCount: number;
  review: ReviewDetail;
  viewer: ReviewListViewer;
}

/** Full-width standalone review content using the same row anatomy, spacing,
 * and divider language as profile reviews. */
export function ReviewConversationContent({
  composerUser,
  deletingReplyId,
  deletingReviewId,
  hasNextReplyPage,
  isAdminMode,
  isCreatingReply,
  isFetchingNextReplyPage,
  isInitialRepliesError,
  isInitialRepliesLoading,
  isNextReplyPageError,
  loadMoreRepliesRef,
  localReplyTail,
  onAuthRequired,
  onCreateReply,
  onDeleteReply,
  onDeleteReview,
  onLikeReply,
  onRetryNextReplyPage,
  onRetryReplies,
  onReviewLikeToggle,
  onShowReplyLikes,
  onShowReviewLikes,
  replyToRevealId,
  replies,
  replyTotalCount,
  review,
  viewer,
}: ReviewConversationContentProps) {
  const [replyBody, setReplyBody] = useState("");
  const [replySubmitError, setReplySubmitError] = useState<string>();
  const [isSubmittingReplyLocally, setIsSubmittingReplyLocally] = useState(false);
  const [replyStatusMessage, setReplyStatusMessage] = useState("");
  const replyComposerRef = useRef<HTMLTextAreaElement>(null);
  const replyFieldId = useId();

  const isReplyBusy = isCreatingReply || isSubmittingReplyLocally;
  const replyDescriptionId = `${replyFieldId}-description`;
  const replyCountId = `${replyFieldId}-count`;
  const replyErrorId = `${replyFieldId}-error`;

  function handleReplyAction() {
    if (!viewer.hasSession) return onAuthRequired();

    replyComposerRef.current?.focus();
  }

  function shakeReplyComposer() {
    const textarea = replyComposerRef.current;
    if (!textarea) return;

    textarea.classList.remove("animate-input-shake");
    window.requestAnimationFrame(() => textarea.classList.add("animate-input-shake"));
  }

  function showReplySubmitError(message: string) {
    setReplySubmitError(message);
    shakeReplyComposer();
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReplyBusy) return;

    const trimmedBody = replyBody.trim();
    if (!trimmedBody) {
      return showReplySubmitError("Write a reply before posting.");
    }

    if (trimmedBody.length > maxReplyLength) {
      setReplySubmitError(undefined);
      return shakeReplyComposer();
    }

    setReplySubmitError(undefined);
    setReplyStatusMessage("");
    setIsSubmittingReplyLocally(true);

    const errorMessage = await onCreateReply(trimmedBody);
    setIsSubmittingReplyLocally(false);

    if (errorMessage) {
      return showReplySubmitError(errorMessage);
    }

    setReplyBody("");
    setReplyStatusMessage("Reply posted.");
    if (replyComposerRef.current) replyComposerRef.current.style.height = "auto";
  }

  function handleReplyBodyChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setReplyBody(event.target.value);
    event.currentTarget.style.height = "auto";
    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 144)}px`;
    setReplySubmitError(undefined);
  }

  const composer = viewer.hasSession ? (
    <form aria-busy={isReplyBusy || undefined} noValidate onSubmit={handleReplySubmit}>
      <div className="flex items-start gap-3">
        {composerUser ? (
          <UserAvatar className="mt-1 size-8 text-xs" name={composerUser.name} src={composerUser.avatarUrl} />
        ) : null}
        <div className="min-w-0 flex-1">
          <FieldGroup className="gap-0">
            <Field data-disabled={isReplyBusy ? true : undefined}>
              <FieldLabel className="sr-only" htmlFor={replyFieldId}>
                Add a reply
              </FieldLabel>
              <Textarea
                aria-describedby={`${replyDescriptionId} ${replyCountId}${replySubmitError ? ` ${replyErrorId}` : ""}`}
                aria-invalid={replySubmitError ? true : undefined}
                className="reply-composer-textarea field-sizing-content block max-h-36 min-h-8 w-full resize-none rounded-none border-0 bg-transparent px-0 py-1 text-[15px] leading-6 shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:ring-0 aria-invalid:ring-0 aria-invalid:placeholder:text-destructive/70"
                id={replyFieldId}
                onAnimationEnd={(event) => event.currentTarget.classList.remove("animate-input-shake")}
                onChange={handleReplyBodyChange}
                placeholder="What do you think?"
                readOnly={isReplyBusy}
                ref={replyComposerRef}
                rows={1}
                value={replyBody}
              />
              <FieldDescription className="sr-only" id={replyDescriptionId}>
                Plain text only, up to {maxReplyLength} characters when posted. Longer drafts can be edited before
                posting.
              </FieldDescription>
              <FieldError id={replyErrorId}>{replySubmitError}</FieldError>
            </Field>
          </FieldGroup>
          <div className="mt-1 flex min-h-8 items-center justify-end gap-1.5">
            <span className={getReplyCountClassName(replyBody.length)} id={replyCountId}>
              {replyBody.length}/{maxReplyLength} characters
            </span>
            <Button
              aria-disabled={isReplyBusy || replyBody.trim().length === 0 || undefined}
              className="px-3 aria-disabled:pointer-events-none aria-disabled:opacity-40"
              size="sm"
              type="submit"
            >
              {isReplyBusy ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              Reply
            </Button>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only" role="status">
        {replyStatusMessage}
      </p>
    </form>
  ) : (
    <div className="flex min-h-10 items-center justify-between gap-4">
      <p className="text-muted-foreground text-sm">Sign in to join the discussion.</p>
      <Button onClick={onAuthRequired} size="sm" type="button" variant="ghost">
        Sign in to reply
      </Button>
    </div>
  );

  return (
    <div>
      <ReviewCard.Root className="border-border/80 last-of-type:border-b">
        <ReviewCard.Header createdAt={review.createdAt} user={review.user} />
        <div className="flex items-start gap-3">
          <ReviewCard.Album album={review.album} className="flex-1" linked />
          <ReviewCard.Rating value={review.rating} />
        </div>
        {review.review ? <ReviewCard.Review collapsed={false}>{review.review}</ReviewCard.Review> : null}
        <ReviewCard.Footer>
          <ReviewCard.Likes
            count={review.likes}
            disabled={!viewer.hasSession}
            liked={review.liked}
            onShowLikes={onShowReviewLikes}
            onToggle={viewer.hasSession ? (liked) => onReviewLikeToggle(review.id, liked) : undefined}
          />
          <Button
            aria-label={`Reply to ${review.user.displayUsername}'s review`}
            className="text-muted-foreground hover:bg-transparent hover:text-primary dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-3.5"
            onClick={handleReplyAction}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MessageCircle aria-hidden="true" />
          </Button>
          <ReviewCard.Share
            album={review.album}
            rating={review.rating}
            reviewBody={review.review}
            reviewId={review.id}
            userDisplayName={review.user.displayUsername}
          />
          <div className="ml-auto">
            <ReviewManagementMenu
              canDeleteAsAdmin={isAdminMode && !review.canDelete}
              canDeleteOwnReview={review.canDelete}
              isDeleting={deletingReviewId === review.id}
              onDelete={onDeleteReview}
            />
          </div>
        </ReviewCard.Footer>
      </ReviewCard.Root>
      <ReplyThread
        composer={composer}
        deletingReplyId={deletingReplyId}
        hasNextPage={hasNextReplyPage}
        hasSession={viewer.hasSession}
        isAdminMode={isAdminMode}
        isFetchingNextPage={isFetchingNextReplyPage}
        isInitialError={isInitialRepliesError}
        isInitialLoading={isInitialRepliesLoading}
        isNextPageError={isNextReplyPageError}
        loadMoreRef={loadMoreRepliesRef}
        localTail={localReplyTail}
        onDelete={onDeleteReply}
        onLikeToggle={onLikeReply}
        onRetryInitial={onRetryReplies}
        onRetryNextPage={onRetryNextReplyPage}
        onShowLikes={onShowReplyLikes}
        replies={replies}
        replyToRevealId={replyToRevealId}
        totalCount={replyTotalCount}
      />
    </div>
  );
}
