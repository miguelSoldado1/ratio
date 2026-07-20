import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { useId, useRef, useState } from "react";
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

const maxReviewLength = 2000;

interface ReviewDrawerProps {
  albumArtist?: string;
  albumId: string;
  albumTitle?: string;
}

export function ReviewDrawer({ albumId, albumArtist, albumTitle }: ReviewDrawerProps) {
  const queryClient = useQueryClient();
  const ratingInputRef = useRef<HTMLDivElement>(null);
  const reviewBodyRef = useRef<HTMLTextAreaElement>(null);
  const reviewTriggerDescriptionId = useId();
  const [open, setOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
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
  const isReviewSubmitBusy = createReviewMutation.isPending || isSubmittingReview;
  const canSaveReview = hasSession && reviewForm.rating > 0 && !isReviewSubmitBusy && !hasCreatedReview;
  const isReviewTriggerDisabled = isCheckingReview || hasCreatedReview;
  const reviewTriggerDescription = hasCreatedReview ? "Already reviewed" : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSaveReview) return;

    const trimmedBody = reviewForm.body.trim();
    if (trimmedBody.length > maxReviewLength) {
      return shakeReviewComposer();
    }

    setIsSubmittingReview(true);

    const data = { albumId, body: reviewForm.body, rating: Math.round(reviewForm.rating * 2) };
    const { error } = await tryCatch(createReviewMutation.mutateAsync({ data }));
    if (error) {
      setIsSubmittingReview(false);
      shakeReviewComposer();
      return toast.error("Couldn't save review", {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
    }

    await queryClient.invalidateQueries({ queryKey: albumQueryKeys.review(albumId) });

    setOpen(false);
    setReviewForm({ body: "", rating: 0 });
    setIsSubmittingReview(false);
  }

  function shakeReviewComposer() {
    const textarea = reviewBodyRef.current;
    if (!textarea) return;

    textarea.classList.remove("animate-input-shake");
    window.requestAnimationFrame(() => textarea.classList.add("animate-input-shake"));
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
      <Drawer direction="bottom" handleOnly onOpenChange={(nextOpen) => setOpen(nextOpen)} open={open}>
        <div className="min-w-0">
          <Button
            aria-busy={isCheckingReview || undefined}
            aria-describedby={reviewTriggerDescription ? reviewTriggerDescriptionId : undefined}
            className="w-full min-w-0 px-3 sm:px-5"
            disabled={isReviewTriggerDisabled}
            onClick={handleReviewTriggerClick}
            size="lg"
            type="button"
          >
            <Pencil data-icon="inline-start" />
            Add a review
          </Button>
          {reviewTriggerDescription ? (
            <span className="sr-only" id={reviewTriggerDescriptionId}>
              {reviewTriggerDescription}
            </span>
          ) : null}
        </div>
        <DrawerContent
          onOpenAutoFocus={(event: Event) => {
            event.preventDefault();
            ratingInputRef.current?.focus();
          }}
        >
          <form className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-2 sm:px-3" onSubmit={handleSubmit}>
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
                <Field className="border-border border-t pt-4">
                  <FieldLabel htmlFor={reviewFormIds.review}>Review</FieldLabel>
                  <Textarea
                    aria-describedby={reviewFormIds.reviewDescription}
                    className="review-composer-textarea rounded-none border-border border-x-0 border-t-0 border-b bg-transparent px-0 py-3 text-[15px] leading-6 shadow-none outline-none ring-0"
                    id={reviewFormIds.review}
                    onAnimationEnd={(event) => event.currentTarget.classList.remove("animate-input-shake")}
                    onChange={(event) => {
                      setReviewForm((form) => ({ ...form, body: event.target.value }));
                    }}
                    placeholder="Write your review here..."
                    ref={reviewBodyRef}
                    value={reviewForm.body}
                  />
                  <FieldDescription
                    className={reviewForm.body.length > maxReviewLength ? "text-destructive" : undefined}
                    id={reviewFormIds.reviewDescription}
                  >
                    {reviewForm.body.length}/{maxReviewLength} characters
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </div>
            <DrawerFooter className="px-4 py-3 sm:py-4">
              <Button aria-busy={isReviewSubmitBusy || undefined} disabled={!canSaveReview} type="submit">
                Save review
              </Button>
              <DrawerClose asChild>
                <Button disabled={isReviewSubmitBusy} type="button" variant="outline">
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
