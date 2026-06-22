import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth/auth-client";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { createReview, hasMyAlbumReview } from "@/server/functions/review-functions";
import { tryCatch } from "@/try-catch";
import { ReviewStarRatingInput } from "./review-star-rating-input";
import type { FormEvent, MouseEvent } from "react";

const reviewFormIds = {
  ratingDescription: "review-rating-description",
  ratingLabel: "review-rating-label",
  review: "review-body",
  reviewDescription: "review-body-description",
} as const;

interface ReviewDrawerProps {
  albumArtist?: string;
  albumId: string;
  albumTitle?: string;
}

export function ReviewDrawer({ albumId, albumArtist, albumTitle }: ReviewDrawerProps) {
  const queryClient = useQueryClient();
  const ratingInputRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ body: "", rating: 0 });
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const hasSession = Boolean(userId);

  const hasMyAlbumReviewFn = useServerFn(hasMyAlbumReview);
  const hasMyAlbumReviewQuery = useQuery({
    enabled: hasSession,
    queryFn: () => hasMyAlbumReviewFn({ data: { albumId } }),
    queryKey: albumQueryKeys.hasMyReview(albumId, userId),
  });

  const createReviewFn = useServerFn(createReview);
  const createReviewMutation = useMutation({ mutationFn: createReviewFn });

  const hasCreatedReview = hasSession && hasMyAlbumReviewQuery.data === true;
  const isCheckingReview = session.isPending || (hasSession && hasMyAlbumReviewQuery.isPending);
  const canSaveReview = hasSession && reviewForm.rating > 0 && !createReviewMutation.isPending && !hasCreatedReview;
  const isReviewTriggerDisabled = isCheckingReview || hasCreatedReview;
  const reviewTriggerLabel = getReviewTriggerLabel({
    hasCreatedReview,
    isCheckingReview,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSaveReview) return;

    const data = { albumId, body: reviewForm.body, rating: Math.round(reviewForm.rating * 2) };
    const { error } = await tryCatch(createReviewMutation.mutateAsync({ data }));
    if (error) {
      return toast.error("Error", { description: error instanceof Error ? error.message : "Something went wrong" });
    }

    await queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(albumId) });

    setOpen(false);
    setReviewForm({ body: "", rating: 0 });
  }

  function handleReviewTriggerClick(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.blur();

    if (isReviewTriggerDisabled) return;

    if (!hasSession) {
      return setAuthDialogOpen(true);
    }

    setOpen(true);
  }

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <Drawer direction="bottom" handleOnly onOpenChange={setOpen} open={open}>
        <Button
          className="min-w-0 px-3 sm:px-5"
          disabled={isReviewTriggerDisabled}
          onClick={handleReviewTriggerClick}
          size="lg"
          type="button"
        >
          <Pencil data-icon="inline-start" />
          {reviewTriggerLabel}
        </Button>
        <DrawerContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            ratingInputRef.current?.focus();
          }}
        >
          <form className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col sm:max-w-md" onSubmit={handleSubmit}>
            <DrawerHeader className="gap-0 px-4 py-3 sm:gap-0.5 sm:py-4">
              <DrawerTitle className="text-sm sm:text-base">Add a review</DrawerTitle>
              <DrawerDescription className="text-xs sm:text-sm">
                {[albumTitle, albumArtist].filter(Boolean).join(" - ")}
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-1">
              <FieldGroup>
                <Field>
                  <FieldTitle id={reviewFormIds.ratingLabel}>Rating</FieldTitle>
                  <ReviewStarRatingInput
                    ariaDescribedBy={reviewFormIds.ratingDescription}
                    ariaLabelledBy={reviewFormIds.ratingLabel}
                    controlRef={ratingInputRef}
                    onChange={(rating) => setReviewForm((form) => ({ ...form, rating }))}
                    value={reviewForm.rating}
                  />
                  <FieldDescription id={reviewFormIds.ratingDescription}>
                    Click or drag across the stars to set your rating.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor={reviewFormIds.review}>Review</FieldLabel>
                  <Textarea
                    aria-describedby={reviewFormIds.reviewDescription}
                    id={reviewFormIds.review}
                    maxLength={2000}
                    onChange={(event) => setReviewForm((form) => ({ ...form, body: event.target.value }))}
                    placeholder="Write your review here..."
                    rows={5}
                    value={reviewForm.body}
                  />
                  <FieldDescription id={reviewFormIds.reviewDescription}>
                    {reviewForm.body.length}/2000 characters
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </div>
            <DrawerFooter className="px-4 py-3 sm:py-4">
              <Button disabled={!canSaveReview} type="submit">
                {createReviewMutation.isPending ? "Saving..." : "Save review"}
              </Button>
              <DrawerClose asChild>
                <Button disabled={createReviewMutation.isPending} type="button" variant="outline">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}

interface ReviewTriggerLabelParams {
  hasCreatedReview: boolean;
  isCheckingReview: boolean;
}

function getReviewTriggerLabel({ hasCreatedReview, isCheckingReview }: ReviewTriggerLabelParams) {
  if (isCheckingReview) return "Checking...";
  if (hasCreatedReview) return "Review added";

  return "Add a review";
}
