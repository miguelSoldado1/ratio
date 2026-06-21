import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ReviewCard } from "@/components/review-card";
import { Skeleton } from "@/components/ui/skeleton";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import { getAlbumReviews } from "@/server/functions/review-functions";

interface ReviewsSectionProps {
  albumId: string;
  className?: string;
}

export function ReviewsSection({ albumId, className }: ReviewsSectionProps) {
  const getAlbumReviewsFn = useServerFn(getAlbumReviews);
  const albumReviewsQuery = useQuery({
    queryFn: () => getAlbumReviewsFn({ data: { albumId } }),
    queryKey: albumQueryKeys.reviews(albumId),
  });

  if (albumReviewsQuery.isPending) {
    return <ReviewsSectionSkeleton className={className} />;
  }

  if (albumReviewsQuery.isError) {
    return (
      <section className={cn("border-border/80 border-t py-8", className)}>
        <p className="font-medium text-sm">Reviews unavailable</p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">Could not load reviews for this album.</p>
      </section>
    );
  }

  if (albumReviewsQuery.data.length === 0) {
    return (
      <section className={cn("border-border/80 border-t py-8", className)}>
        <p className="font-medium text-sm">No reviews yet</p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          Reviews will appear here once people start rating this album.
        </p>
      </section>
    );
  }

  return (
    <section className={className}>
      {albumReviewsQuery.data.map((review) => (
        <ReviewCard.Root className="border-border/80" key={review.id}>
          <ReviewCard.Header createdAt={review.createdAt} href={`/user/${review.user.username}`} user={review.user} />
          <ReviewCard.Rating value={review.rating} />
          {review.review ? <ReviewCard.Review>{review.review}</ReviewCard.Review> : null}
        </ReviewCard.Root>
      ))}
    </section>
  );
}

function ReviewsSectionSkeleton({ className }: { className?: string }) {
  return (
    <section aria-label="Loading album reviews" className={cn("border-border/80 border-t py-8", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="mt-4 h-4 w-20" />
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-5/6 max-w-xl" />
      </div>
    </section>
  );
}
