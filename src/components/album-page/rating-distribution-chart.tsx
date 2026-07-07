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
          const barScale = hasRatings ? Math.max(item.count / maxCount, 0.04) : 0.025;
          const ratingRange = getRatingBucketRange(item.rating);

          return (
            <div className="flex h-full min-w-0 items-end" key={item.rating}>
              <div
                className={cn(
                  "transform-[scaleY(var(--rating-bar-scale))] starting:transform-[scaleY(0.025)] h-full w-full origin-bottom rounded-t-sm transition-[background-color,transform] duration-220 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none",
                  hasRatings ? "bg-primary [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/80" : "bg-muted"
                )}
                style={{ "--rating-bar-scale": barScale } as CSSProperties}
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
            <p className="mt-1 text-2xs text-muted-foreground-subtle tabular-nums">
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
