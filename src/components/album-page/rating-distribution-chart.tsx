import { abbreviateCount, cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import type { getAlbumRatingSummary } from "@/server/functions/review-functions";

interface RatingDistributionChartProps {
  ratingDistribution: Awaited<ReturnType<typeof getAlbumRatingSummary>>["ratingDistribution"];
}

export function RatingDistributionChart({ ratingDistribution }: RatingDistributionChartProps) {
  const hasRatings = ratingDistribution.some((item) => item.count > 0);
  const maxCount = Math.max(1, ...ratingDistribution.map((item) => item.count));

  return (
    <div
      aria-label={hasRatings ? "Ratings distribution by rating range from 0.5 to 5" : "No ratings distribution yet"}
      role="img"
    >
      <div className="grid h-32 grid-cols-5 items-end gap-3 border-border border-b pb-2 sm:h-40 sm:gap-5">
        {ratingDistribution.map((item) => {
          const barHeight = hasRatings ? Math.max((item.count / maxCount) * 100, 4) : 2.5;
          const ratingRange = getRatingBucketRange(item.rating);

          return (
            <div className="flex h-full min-w-0 items-end" key={item.rating}>
              <div
                className={cn(
                  "h-(--rating-bar-height) starting:h-0 min-h-1 w-full origin-bottom rounded-t-sm transition-[background-color,height] duration-220 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none",
                  hasRatings ? "bg-chart-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-chart-2/80" : "bg-muted"
                )}
                style={{ "--rating-bar-height": `${barHeight}%` } as CSSProperties}
                title={hasRatings ? `${abbreviateCount(item.count)} ratings from ${ratingRange}` : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-3 pt-2 sm:gap-5">
        {ratingDistribution.map((item) => (
          <div className="min-w-0 text-center" key={item.rating}>
            <p className={cn("font-medium text-xs tabular-nums", !hasRatings && "text-muted-foreground")}>
              {getRatingBucketRange(item.rating)}
            </p>
            <p className="mt-1 text-muted-foreground text-xs tabular-nums">
              {hasRatings ? abbreviateCount(item.count) : "0"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRatingBucketRange(rating: string) {
  const upperBound = Number(rating);
  const lowerBound = upperBound - 0.5;

  return `${formatRatingBucketBoundary(lowerBound)}-${formatRatingBucketBoundary(upperBound)}`;
}

function formatRatingBucketBoundary(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
