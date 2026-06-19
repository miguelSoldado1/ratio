import { ReviewCard } from "@/components/review-card";
import { cn } from "@/lib/utils";
import type { AlbumPageData } from "@/lib/album-page-mock";

export function ReviewsSection({ className, reviews }: { className?: string; reviews: AlbumPageData["reviews"] }) {
  if (reviews.length === 0) {
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
      {reviews.map((review) => (
        <ReviewCard.Root className="border-border/80" key={review.id}>
          <ReviewCard.Header createdAt={review.createdAt} href={`/user/${review.user.username}`} user={review.user} />
          <ReviewCard.Rating value={review.rating} />
          {review.review ? <ReviewCard.Review>{review.review}</ReviewCard.Review> : null}
          {review.likes === undefined ? null : (
            <ReviewCard.Footer>
              <ReviewCard.Likes count={review.likes} liked={review.liked} />
            </ReviewCard.Footer>
          )}
        </ReviewCard.Root>
      ))}
    </section>
  );
}
