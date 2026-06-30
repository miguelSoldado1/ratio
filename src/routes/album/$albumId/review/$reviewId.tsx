import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReviewLikesDialog } from "@/components/review-likes-dialog";
import { InitialReviewDialogShell } from "@/components/review-permalink/initial-review-dialog-shell";
import { ReviewDialogReview } from "@/components/review-permalink/review-dialog-review";
import { ReviewDialogSkeleton } from "@/components/review-permalink/review-dialog-skeleton";
import { ReviewUnavailable } from "@/components/review-permalink/review-unavailable";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminMode } from "@/hooks/use-admin-mode";
import { useReviewDelete } from "@/hooks/use-review-delete";
import { useReviewLikeToggle } from "@/hooks/use-review-like-toggle";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getReviewById } from "@/server/functions/review-functions";

export const Route = createFileRoute("/album/$albumId/review/$reviewId")({
  component: AlbumReviewRoute,
});

function AlbumReviewRoute() {
  const { albumId, reviewId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const { adminModeEnabled, isAdmin } = useAdminMode();
  const [likesOpen, setLikesOpen] = useState(false);

  const userId = session.data?.user.id;
  const hasSession = Boolean(userId);

  const viewer = useMemo(() => ({ hasSession, userId }), [hasSession, userId]);
  const [portalReady, setPortalReady] = useState(false);

  const reviewQueryKey = albumQueryKeys.reviewDetail(albumId, reviewId, userId);
  const albumReviewsQueryKey = albumQueryKeys.reviews(albumId, userId);
  const reviewLikeQueryKeys = useMemo(
    () => [reviewQueryKey, albumReviewsQueryKey],
    [albumReviewsQueryKey, reviewQueryKey]
  );

  const closeReviewDialog = useCallback(() => {
    navigate({ params: { albumId }, to: "/album/$albumId" });
  }, [albumId, navigate]);

  const getReviewByIdFn = useServerFn(getReviewById);
  const reviewQuery = useQuery({
    enabled: !session.isPending,
    meta: { suppressErrorToast: true },
    queryFn: () => getReviewByIdFn({ data: { albumId, reviewId } }),
    queryKey: reviewQueryKey,
  });

  const handleReviewLikeToggle = useReviewLikeToggle({
    enabled: hasSession,
    queryKeys: reviewLikeQueryKeys,
  });

  const handleReviewDeleted = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(albumId) });
    closeReviewDialog();
  }, [albumId, closeReviewDialog, queryClient]);

  const { deleteReview: handleReviewDelete, deletingReviewId } = useReviewDelete({
    onDeleted: handleReviewDeleted,
  });

  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!portalReady) {
    return <InitialReviewDialogShell />;
  }

  return (
    <>
      <Dialog defaultOpen onOpenChange={(open) => !open && closeReviewDialog()}>
        <DialogContent className="data-open:zoom-in-100 flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 duration-0 data-open:animate-none sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Review</DialogTitle>
            <DialogDescription>Focused review dialog.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-5 pt-5 pr-12 pb-5 sm:px-6 sm:pt-6 sm:pr-14 sm:pb-6">
            {reviewQuery.isPending ? <ReviewDialogSkeleton /> : null}
            {reviewQuery.isError ? <ReviewUnavailable onClose={closeReviewDialog} /> : null}
            {reviewQuery.data ? (
              <ReviewDialogReview
                adminModeEnabled={adminModeEnabled}
                deletingReviewId={deletingReviewId}
                hasSession={hasSession}
                isAdmin={isAdmin}
                onDelete={handleReviewDelete}
                onLikeToggle={handleReviewLikeToggle}
                onShowLikes={() => setLikesOpen(true)}
                review={reviewQuery.data}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <ReviewLikesDialog
        onOpenChange={(nextOpen) => setLikesOpen(nextOpen)}
        open={likesOpen}
        reviewId={reviewId}
        viewer={viewer}
      />
    </>
  );
}
