import { ReviewCardSkeleton } from "@/components/review-card-skeleton";
import { cn } from "@/lib/utils";

export function ReviewsSectionSkeleton({ className }: { className?: string }) {
  return (
    <section aria-label="Loading album reviews" className={cn("border-border/80 border-t", className)}>
      <h2 className="sr-only">Reviews</h2>
      <ReviewCardSkeleton.Root>
        <ReviewCardSkeleton.Header />
        <div className="flex items-start gap-3">
          <ReviewCardSkeleton.Album />
          <ReviewCardSkeleton.Rating />
        </div>
        <ReviewCardSkeleton.Review />
        <ReviewCardSkeleton.Footer />
      </ReviewCardSkeleton.Root>
    </section>
  );
}
