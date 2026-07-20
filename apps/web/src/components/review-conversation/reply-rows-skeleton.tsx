import { ReviewCardSkeleton } from "@/components/review-card-skeleton";

const replySkeletonIds = ["reply-skeleton-one", "reply-skeleton-two"] as const;

export function ReplyRowsSkeleton({ count }: { count: 1 | 2 }) {
  return (
    <div aria-hidden="true" className="divide-y divide-border/80">
      {replySkeletonIds.slice(0, count).map((skeletonId) => (
        <ReviewCardSkeleton.Root className="border-0 py-4" key={skeletonId}>
          <ReviewCardSkeleton.Header />
          <ReviewCardSkeleton.Review />
          <ReviewCardSkeleton.Footer />
        </ReviewCardSkeleton.Root>
      ))}
    </div>
  );
}
