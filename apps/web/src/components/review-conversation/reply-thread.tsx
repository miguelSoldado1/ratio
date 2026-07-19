import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ReplyRow } from "./reply-row";
import type { ReactNode, RefObject } from "react";
import type { ReviewReply } from "@/lib/tanstack-query/review-reply-cache";

interface ReplyThreadProps {
  /** Composer rendered between the discussion heading and the replies. */
  composer?: ReactNode;
  deletingReplyId: string | null;
  hasNextPage: boolean;
  hasSession: boolean;
  isAdminMode: boolean;
  isFetchingNextPage: boolean;
  isInitialError: boolean;
  isInitialLoading: boolean;
  isNextPageError: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  localTail: ReviewReply[];
  onDelete: (replyId: string) => Promise<boolean>;
  onLikeToggle: (replyId: string, liked: boolean) => boolean | Promise<boolean | undefined> | undefined;
  onRetryInitial: () => void;
  onRetryNextPage: () => void;
  onShowLikes: (replyId: string) => void;
  replies: ReviewReply[];
  totalCount: number;
}

export function ReplyThread({
  composer,
  deletingReplyId,
  hasNextPage,
  hasSession,
  isAdminMode,
  isFetchingNextPage,
  isInitialError,
  isInitialLoading,
  isNextPageError,
  loadMoreRef,
  localTail,
  onDelete,
  onLikeToggle,
  onShowLikes,
  onRetryInitial,
  onRetryNextPage,
  replies,
  totalCount,
}: ReplyThreadProps) {
  const headingId = useId();
  const newlyPostedLabelId = `${headingId}-newly-posted`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const replyRefs = useRef(new Map<string, HTMLElement>());

  const allVisibleReplies = [...replies, ...localTail];
  const showNextPageError = isNextPageError && !isFetchingNextPage;

  function setReplyRef(replyId: string, node: HTMLElement | null) {
    if (node) {
      return replyRefs.current.set(replyId, node);
    }

    replyRefs.current.delete(replyId);
  }

  async function handleDelete(replyId: string) {
    const replyIndex = allVisibleReplies.findIndex((reply) => reply.id === replyId);
    const nextReplyId = allVisibleReplies[replyIndex + 1]?.id;
    const deleted = await onDelete(replyId);

    if (deleted) {
      window.requestAnimationFrame(() => {
        (nextReplyId ? replyRefs.current.get(nextReplyId) : headingRef.current)?.focus();
      });
    }

    return deleted;
  }

  return (
    <section aria-labelledby={headingId} className="pt-7 sm:pt-8">
      <h2 className="font-semibold text-base text-foreground sm:text-lg" id={headingId} ref={headingRef} tabIndex={-1}>
        Discussion
        {isInitialLoading || isInitialError ? null : (
          <>
            {" "}
            <span className="font-medium text-muted-foreground">({totalCount})</span>
          </>
        )}
      </h2>
      {composer ? <div className="mt-4 border-border/80 border-y py-4">{composer}</div> : null}
      {isInitialLoading ? <ReplyThreadLoading /> : null}
      {isInitialError ? <ReplyThreadInitialError onRetry={onRetryInitial} /> : null}
      {!(isInitialLoading || isInitialError) && replies.length === 0 && localTail.length === 0 ? (
        <p className="py-4 text-muted-foreground text-sm">No replies yet. Start the discussion.</p>
      ) : null}
      {replies.length > 0 ? (
        <ol className={cn("divide-y divide-border/80", !composer && "mt-3")}>
          {replies.map((reply) => (
            <li key={reply.id}>
              <ReplyRow
                articleRef={(node) => setReplyRef(reply.id, node)}
                canDeleteAsAdmin={isAdminMode && !reply.canDelete}
                hasSession={hasSession}
                isDeleting={deletingReplyId === reply.id}
                onDelete={() => handleDelete(reply.id)}
                onLikeToggle={(liked) => onLikeToggle(reply.id, liked)}
                onShowLikes={() => onShowLikes(reply.id)}
                reply={reply}
              />
            </li>
          ))}
        </ol>
      ) : null}
      {(hasNextPage || isFetchingNextPage) && !showNextPageError ? (
        <ReplyPaginationSentinel isFetchingNextPage={isFetchingNextPage} loadMoreRef={loadMoreRef} />
      ) : null}
      {showNextPageError ? (
        <div className="flex items-center justify-between gap-3 border-border/60 border-t py-4">
          <p className="text-muted-foreground text-sm" role="alert">
            Couldn't load more replies.
          </p>
          <Button onClick={onRetryNextPage} size="sm" type="button" variant="outline">
            Retry loading replies
          </Button>
        </div>
      ) : null}
      {localTail.length > 0 ? (
        <div className="border-border/80 border-t pt-4">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide" id={newlyPostedLabelId}>
            Newly posted
          </p>
          <ol aria-labelledby={newlyPostedLabelId} className="divide-y divide-border/80">
            {localTail.map((reply) => (
              <li key={reply.id}>
                <ReplyRow
                  articleRef={(node) => setReplyRef(reply.id, node)}
                  canDeleteAsAdmin={isAdminMode && !reply.canDelete}
                  hasSession={hasSession}
                  isDeleting={deletingReplyId === reply.id}
                  onDelete={() => handleDelete(reply.id)}
                  onLikeToggle={(liked) => onLikeToggle(reply.id, liked)}
                  onShowLikes={() => onShowLikes(reply.id)}
                  reply={reply}
                />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

interface ReplyPaginationSentinelProps {
  isFetchingNextPage: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
}

function ReplyPaginationSentinel({ isFetchingNextPage, loadMoreRef }: ReplyPaginationSentinelProps) {
  return (
    <div
      aria-busy={isFetchingNextPage || undefined}
      className="flex h-12 items-center justify-center border-border/60 border-t"
      data-slot="reply-pagination-sentinel"
      ref={loadMoreRef}
      role={isFetchingNextPage ? "status" : undefined}
    >
      {isFetchingNextPage ? (
        <>
          <Spinner aria-hidden="true" className="text-muted-foreground" />
          <span className="sr-only">Loading more replies…</span>
        </>
      ) : null}
    </div>
  );
}

function ReplyThreadInitialError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-6" role="alert">
      <p className="font-medium text-sm">Replies unavailable</p>
      <p className="mt-1 text-muted-foreground text-sm">
        The review is still available. Try loading its replies again.
      </p>
      <Button className="mt-3" onClick={onRetry} size="sm" type="button" variant="outline">
        Retry
      </Button>
    </div>
  );
}

function ReplyThreadLoading() {
  return (
    <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm" role="status">
      <Spinner aria-hidden="true" />
      Loading replies…
    </div>
  );
}
