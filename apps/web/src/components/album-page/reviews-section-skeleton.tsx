import { ReviewSkeletonCard } from "@/components/review-list";
import { cn } from "@/lib/utils";

export function ReviewsSectionSkeleton({ className }: { className?: string }) {
  return (
    <section aria-label="Loading album reviews" className={cn("border-border/80 border-t", className)}>
      <h2 className="sr-only">Reviews</h2>
      <ReviewSkeletonCard />
    </section>
  );
}
