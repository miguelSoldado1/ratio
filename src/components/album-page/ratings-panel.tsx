import { ReviewCard } from "@/components/review-card";
import { cn } from "@/lib/utils";
import { RatingDistributionChart } from "./rating-distribution-chart";
import type { AlbumPageData } from "@/lib/album-page-mock";

export function RatingsPanel({
  className,
  ratingDistribution,
  ratingSummary,
}: {
  className?: string;
  ratingDistribution: AlbumPageData["ratingDistribution"];
  ratingSummary: AlbumPageData["ratingSummary"];
}) {
  const hasRatings = ratingSummary !== null && ratingDistribution.some((item) => item.count > 0);

  return (
    <section aria-label="Album ratings" className={cn("border-border border-t py-5", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          {hasRatings ? (
            <ReviewCard.Rating className="[&_span]:text-base [&_svg]:size-5" value={ratingSummary.average} />
          ) : (
            <p className="font-medium text-base">No ratings yet</p>
          )}
        </div>
        <p className="text-muted-foreground text-sm tabular-nums">{hasRatings ? ratingSummary.total : "0 ratings"}</p>
      </div>
      <RatingDistributionChart ratingDistribution={ratingDistribution} />
    </section>
  );
}
