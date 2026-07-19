import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isNotFound, notFound, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { InlineError } from "@/components/inline-error";
import { ReplyLikesDialog } from "@/components/reply-likes-dialog";
import { ReviewLikesDialog } from "@/components/review-likes-dialog";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { useCreateReviewReply } from "@/hooks/use-create-review-reply";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys, feedQueryKeys, reviewQueryKeys, userQueryKeys } from "@/lib/tanstack-query/query-keys";
import {
  addReviewReply,
  flattenReviewReplies,
  isReviewReplyCountData,
  reconcileReviewReplyLocalTail,
  removeReviewReply,
  updateReviewReplyCountInPages,
  updateReviewReplyLike,
} from "@/lib/tanstack-query/review-reply-cache";
import { getReviewById } from "@/server/functions/review-functions";
import { deleteReviewReply, getReviewReplies, setReviewReplyLike } from "@/server/functions/review-reply-functions";
import { tryCatch } from "@/try-catch";
import { ReviewConversationContent } from "./review-conversation-content";
import { ReviewConversationSkeleton } from "./review-conversation-skeleton";
import { ReviewPageShell } from "./review-page-shell";
import type { InfiniteData } from "@tanstack/react-query";
import type { ReviewRepliesData, ReviewReply, ReviewReplyCountPage } from "@/lib/tanstack-query/review-reply-cache";

interface ReviewConversationProps {
  reviewId: string;
}

export function ReviewConversation({ reviewId: routeReviewId }: ReviewConversationProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const session = authClient.useSession();
  const { adminModeEnabled, isAdmin } = useAdminMode();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [reviewLikesId, setReviewLikesId] = useState<string>();
  const [replyLikesId, setReplyLikesId] = useState<string>();
  const [localReplyTail, setLocalReplyTail] = useState<ReviewReply[]>([]);
  const [replyToRevealId, setReplyToRevealId] = useState<string>();
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);

  const userId = session.data?.user.id;
  const hasSession = Boolean(userId);

  // The tail carries viewer-specific `liked`/`canDelete`, so it must not
  // survive a sign-in/sign-out from the dialog's own auth flow.
  const [tailViewerId, setTailViewerId] = useState(userId);
  if (tailViewerId !== userId) {
    setTailViewerId(userId);
    setLocalReplyTail([]);
  }

  const viewer = useMemo(() => ({ hasSession, userId }), [hasSession, userId]);

  const reviewQueryKey = reviewQueryKeys.detail(routeReviewId, userId);

  const getReviewByIdFn = useServerFn(getReviewById);
  const reviewQuery = useQuery({
    enabled: !session.isPending,
    meta: { suppressErrorToast: true },
    queryFn: () => getReviewByIdFn({ data: { reviewId: routeReviewId } }),
    queryKey: reviewQueryKey,
  });

  const albumId = reviewQuery.data?.album.id;
  const albumReviewsQueryKey = albumId ? albumQueryKeys.reviews(albumId, userId) : undefined;
  const reviewLikeQueryKeys = useMemo(
    () => (albumReviewsQueryKey ? [reviewQueryKey, albumReviewsQueryKey] : [reviewQueryKey]),
    [albumReviewsQueryKey, reviewQueryKey]
  );
  const reviewId = reviewQuery.data?.id;
  const repliesQueryKey = reviewQueryKeys.replies(reviewId ?? "pending", userId);

  const getReviewRepliesFn = useServerFn(getReviewReplies);
  const repliesQuery = useInfiniteQuery({
    enabled: Boolean(reviewId) && !session.isPending,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    meta: { suppressErrorToast: true },
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getReviewRepliesFn({ data: { cursor: pageParam ?? undefined, reviewId: reviewId ?? "" } }),
    queryKey: repliesQueryKey,
  });

  const { createReply, isCreatingReply } = useCreateReviewReply();

  const deleteReviewReplyFn = useServerFn(deleteReviewReply);
  const deleteReplyMutation = useMutation({ mutationFn: deleteReviewReplyFn });

  const setReviewReplyLikeFn = useServerFn(setReviewReplyLike);
  const likeReplyMutation = useMutation({ mutationFn: setReviewReplyLikeFn });

  const handleReviewLikeToggle = useReviewLikeToggle({
    enabled: hasSession,
    queryKeys: reviewLikeQueryKeys,
  });

  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete({
    onDeleted: async (deletedReview) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(deletedReview.albumId) }),
        queryClient.invalidateQueries({ queryKey: reviewQueryKey }),
      ]);
      await router.navigate({ params: { albumId: deletedReview.albumId }, to: "/album/$albumId" });
    },
  });

  const loadedReplies = flattenReviewReplies(repliesQuery.data);
  const visibleLocalReplyTail = reconcileReviewReplyLocalTail(localReplyTail, loadedReplies);
  const replyTotalCount = repliesQuery.data?.pages[0]?.totalCount ?? 0;
  const loadMoreRepliesRef = useLoadMoreOnIntersect({
    enabled: Boolean(repliesQuery.hasNextPage) && !repliesQuery.isFetchNextPageError,
    isLoading: repliesQuery.isFetchingNextPage,
    onLoadMore: repliesQuery.fetchNextPage,
  });

  /** Narrow patch of the review's cached reply count on every loaded review
   * list. Never invalidates For You ranking or unrelated profile data. */
  function patchReplyCountCaches(targetReviewId: string, updateCount: (replyCount: number) => number) {
    if (albumReviewsQueryKey) {
      queryClient.setQueryData<InfiniteData<ReviewReplyCountPage>>(albumReviewsQueryKey, (data) =>
        updateReviewReplyCountInPages(data, targetReviewId, updateCount)
      );
    }
    for (const queryKey of [feedQueryKeys.all(), userQueryKeys.all()]) {
      queryClient.setQueriesData({ queryKey }, (data: unknown) =>
        isReviewReplyCountData(data) ? updateReviewReplyCountInPages(data, targetReviewId, updateCount) : data
      );
    }
  }

  async function handleCreateReply(body: string) {
    if (!reviewId) return "This review is no longer available.";

    const result = await createReply(reviewId, body);
    if (result.error !== null) return result.error;

    const createdReply = result.reply;

    const cachedReplies = queryClient.getQueryData<ReviewRepliesData>(repliesQueryKey);
    if (cachedReplies) {
      queryClient.setQueryData<ReviewRepliesData>(repliesQueryKey, (data) =>
        addReviewReply(data, createdReply, { appendToLoadedPages: false })
      );
    } else {
      await queryClient.invalidateQueries({ queryKey: repliesQueryKey });
    }

    setLocalReplyTail((tail) => reconcileReviewReplyLocalTail([...tail, createdReply], loadedReplies));
    setReplyToRevealId(createdReply.id);

    return null;
  }

  async function handleDeleteReply(replyId: string) {
    setDeletingReplyId(replyId);

    try {
      const { data: deletedReply, error } = await tryCatch(deleteReplyMutation.mutateAsync({ data: { replyId } }));
      if (error) {
        toast.error("Couldn't delete reply", {
          description: error instanceof Error ? error.message : "Something went wrong. Try again.",
        });
        return false;
      }

      queryClient.setQueryData<ReviewRepliesData>(repliesQueryKey, (data) =>
        removeReviewReply(data, replyId, deletedReply.replyCount)
      );
      setLocalReplyTail((tail) => tail.filter((reply) => reply.id !== replyId));
      setReplyToRevealId((currentReplyId) => (currentReplyId === replyId ? undefined : currentReplyId));
      patchReplyCountCaches(deletedReply.reviewId, () => deletedReply.replyCount);

      return true;
    } finally {
      setDeletingReplyId(null);
    }
  }

  async function handleLikeReply(replyId: string, liked: boolean) {
    if (!hasSession) return false;

    const { data: updatedReply, error } = await tryCatch(likeReplyMutation.mutateAsync({ data: { liked, replyId } }));
    if (error) {
      toast.error("Couldn't update reply like", {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
      return false;
    }

    queryClient.setQueryData<ReviewRepliesData>(repliesQueryKey, (data) => updateReviewReplyLike(data, updatedReply));
    setLocalReplyTail((tail) =>
      tail.map((reply) =>
        reply.id === updatedReply.replyId ? { ...reply, liked: updatedReply.liked, likes: updatedReply.likes } : reply
      )
    );
  }

  if (reviewQuery.isPending) {
    return (
      <ReviewPageShell pending>
        <ReviewConversationSkeleton />
      </ReviewPageShell>
    );
  }

  if (reviewQuery.isError) {
    if (isNotFound(reviewQuery.error)) throw reviewQuery.error;

    return (
      <ReviewPageShell>
        <InlineError description="Could not load this review right now." title="Review unavailable" />
      </ReviewPageShell>
    );
  }

  const review = reviewQuery.data;
  if (!review) throw notFound();

  return (
    <ReviewPageShell album={review.album}>
      <ReviewConversationContent
        composerUser={
          session.data?.user
            ? {
                avatarUrl: session.data.user.image ?? undefined,
                name: session.data.user.displayUsername ?? session.data.user.name,
              }
            : undefined
        }
        deletingReplyId={deletingReplyId}
        deletingReviewId={deletingReviewId}
        hasNextReplyPage={Boolean(repliesQuery.hasNextPage)}
        isAdminMode={isAdmin && adminModeEnabled}
        isCreatingReply={isCreatingReply}
        isFetchingNextReplyPage={repliesQuery.isFetchingNextPage}
        isInitialRepliesError={repliesQuery.isError && !repliesQuery.data}
        isInitialRepliesLoading={repliesQuery.isPending}
        isNextReplyPageError={repliesQuery.isFetchNextPageError}
        loadMoreRepliesRef={loadMoreRepliesRef}
        localReplyTail={visibleLocalReplyTail}
        onAuthRequired={() => setAuthDialogOpen(true)}
        onCreateReply={handleCreateReply}
        onDeleteReply={handleDeleteReply}
        onDeleteReview={() => handleReviewDelete(review.id)}
        onLikeReply={handleLikeReply}
        onRetryNextReplyPage={() => repliesQuery.fetchNextPage().catch(() => undefined)}
        onRetryReplies={() => repliesQuery.refetch().catch(() => undefined)}
        onReviewLikeToggle={handleReviewLikeToggle}
        onShowReplyLikes={setReplyLikesId}
        onShowReviewLikes={() => setReviewLikesId(review.id)}
        replies={loadedReplies}
        replyToRevealId={replyToRevealId}
        replyTotalCount={replyTotalCount}
        review={review}
        viewer={viewer}
      />
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <ReviewLikesDialog
        onOpenChange={(open) => {
          if (!open) setReviewLikesId(undefined);
        }}
        reviewId={reviewLikesId}
        viewer={viewer}
      />
      <ReplyLikesDialog
        onOpenChange={(open) => {
          if (!open) setReplyLikesId(undefined);
        }}
        replyId={replyLikesId}
        viewer={viewer}
      />
    </ReviewPageShell>
  );
}
