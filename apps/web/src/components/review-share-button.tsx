import { Share2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tryCatch } from "@/try-catch";

const excerptMaxLength = 150;
const excerptMinWordBoundaryLength = 120;
const minExcerptLength = 40;
const maxShareTextLength = 280;
const repeatedWhitespacePattern = /\s+/g;
const trailingExcerptPunctuationPattern = /[\s,;:.-]+$/g;

export interface ReviewShareAlbum {
  artist: string;
  id: string;
  title: string;
}

interface ReviewShareButtonProps {
  album: ReviewShareAlbum;
  rating: number;
  reviewBody?: string;
  reviewId: string;
  userDisplayName: string;
}

export function ReviewShareButton({ album, rating, reviewBody, reviewId, userDisplayName }: ReviewShareButtonProps) {
  const sharingRef = useRef(false);

  async function handleShareClick() {
    if (sharingRef.current) return;

    sharingRef.current = true;
    const permalinkPath = `/review/${encodeURIComponent(reviewId)}`;
    const permalink = new URL(permalinkPath, window.location.origin).href;
    const shareText = createReviewShareText({ album, permalink, rating, reviewBody, userDisplayName });

    const { data: copiedToClipboard, error } = await tryCatch(shareReview(shareText));
    sharingRef.current = false;

    if (error) {
      return toast.error("Couldn't copy review", { description: "Something went wrong while copying the review." });
    }

    if (copiedToClipboard) {
      return toast.success("Review copied", { description: "The review is on your clipboard." });
    }
  }

  return (
    <Button
      aria-label="Share review"
      className="text-muted-foreground hover:bg-transparent hover:text-primary dark:hover:bg-transparent"
      onClick={handleShareClick}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <Share2 className="size-3.5" data-icon="inline-start" />
    </Button>
  );
}

interface CreateReviewShareTextParams {
  album: ReviewShareAlbum;
  permalink: string;
  rating: number;
  reviewBody?: string;
  userDisplayName: string;
}

function createReviewShareText({ album, permalink, rating, reviewBody, userDisplayName }: CreateReviewShareTextParams) {
  const intro = `${userDisplayName} reviewed ${album.title} by ${album.artist}`;
  const ratingLine = `${formatReviewStars(rating)} ${formatReviewRating(rating)}`;
  const excerpt = formatReviewExcerpt(reviewBody, getAvailableExcerptLength({ intro, permalink, ratingLine }));
  const textWithoutUrl = [intro, ratingLine, excerpt || null]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return `${textWithoutUrl}\n${permalink}`;
}

function formatReviewStars(rating: number) {
  const normalizedRating = normalizeRating(rating);
  const fullStars = Math.floor(normalizedRating);
  const hasHalfStar = normalizedRating % 1 !== 0;
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalfStar ? 1 : 0));

  return `${"★".repeat(fullStars)}${hasHalfStar ? "½" : ""}${"☆".repeat(emptyStars)}`;
}

function formatReviewRating(rating: number) {
  const normalizedRating = normalizeRating(rating);

  return `${Number.isInteger(normalizedRating) ? normalizedRating : normalizedRating.toFixed(1)}/5`;
}

function formatReviewExcerpt(reviewBody: string | undefined, maxLength: number) {
  const normalizedBody = reviewBody?.trim().replace(repeatedWhitespacePattern, " ");

  if (!normalizedBody) return null;
  if (maxLength < minExcerptLength) return null;
  if (normalizedBody.length <= maxLength) return normalizedBody;

  const clippedBody = normalizedBody.slice(0, maxLength);
  const wordBoundaryIndex = clippedBody.lastIndexOf(" ");
  const wordBoundaryMinLength = Math.min(excerptMinWordBoundaryLength, Math.floor(maxLength * 0.8));
  const excerpt = wordBoundaryIndex >= wordBoundaryMinLength ? clippedBody.slice(0, wordBoundaryIndex) : clippedBody;

  return `${excerpt.replace(trailingExcerptPunctuationPattern, "")}...`;
}

interface GetAvailableExcerptLengthParams {
  intro: string;
  permalink: string;
  ratingLine: string;
}

function getAvailableExcerptLength({ intro, permalink, ratingLine }: GetAvailableExcerptLengthParams) {
  const textWithoutExcerpt = `${intro}\n${ratingLine}\n${permalink}`;
  const excerptOverheadLength = "\n".length + "...".length;

  return Math.min(excerptMaxLength, maxShareTextLength - textWithoutExcerpt.length - excerptOverheadLength);
}

async function shareReview(shareText: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    const { error } = await tryCatch(navigator.share({ text: shareText }));

    if (!error || isNativeShareCancellation(error)) return false;
  }

  await copyTextToClipboard(shareText);

  return true;
}

function normalizeRating(rating: number) {
  return Math.min(5, Math.max(0, Math.round(rating * 2) / 2));
}

function isNativeShareCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    return await navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command failed");
    }
  } finally {
    textarea.remove();
  }
}
