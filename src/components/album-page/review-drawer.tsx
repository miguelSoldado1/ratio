import { Pencil } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ReviewStarRatingInput } from "./review-star-rating-input";
import type { FormEvent } from "react";

interface ReviewDrawerProps {
  albumArtist?: string;
  albumTitle?: string;
}

export function ReviewDrawer({ albumArtist, albumTitle }: ReviewDrawerProps) {
  const ratingDescriptionId = useId();
  const ratingLabelId = useId();
  const reviewDescriptionId = useId();
  const reviewId = useId();
  const ratingInputRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const canSaveReview = rating > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSaveReview) return;

    setOpen(false);
  }

  return (
    <Drawer direction="bottom" handleOnly onOpenChange={setOpen} open={open}>
      <DrawerTrigger asChild>
        <Button
          className="min-w-0 px-3 sm:px-5"
          onClick={(event) => event.currentTarget.blur()}
          size="lg"
          type="button"
        >
          <Pencil data-icon="inline-start" />
          Add a review
        </Button>
      </DrawerTrigger>
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
                <FieldTitle id={ratingLabelId}>Rating</FieldTitle>
                <ReviewStarRatingInput
                  ariaDescribedBy={ratingDescriptionId}
                  ariaLabelledBy={ratingLabelId}
                  controlRef={ratingInputRef}
                  onChange={setRating}
                  value={rating}
                />
                <FieldDescription id={ratingDescriptionId}>
                  Click or drag across the stars to set your rating.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={reviewId}>Review</FieldLabel>
                <Textarea
                  aria-describedby={reviewDescriptionId}
                  id={reviewId}
                  maxLength={2000}
                  onChange={(event) => setReview(event.target.value)}
                  placeholder="Write your review here..."
                  rows={5}
                  value={review}
                />
                <FieldDescription id={reviewDescriptionId}>{review.length}/2000 characters</FieldDescription>
              </Field>
            </FieldGroup>
          </div>
          <DrawerFooter className="px-4 py-3 sm:py-4">
            <Button disabled={!canSaveReview} type="submit">
              Save review
            </Button>
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
