import { abbreviateCount, cn } from "@/lib/utils";
import type { AlbumPageData } from "@/lib/album-page-mock";

export function RatingDistributionChart({
  ratingDistribution,
}: {
  ratingDistribution: AlbumPageData["ratingDistribution"];
}) {
  const hasRatings = ratingDistribution.some((item) => item.count > 0);
  const maxCount = Math.max(1, ...ratingDistribution.map((item) => item.count));

  return (
    <div aria-label={hasRatings ? "Ratings distribution from 1 to 5" : "No ratings distribution yet"} role="img">
      <div className="grid h-32 grid-cols-5 items-end gap-3 border-border border-b pb-2 sm:h-40 sm:gap-5">
        {ratingDistribution.map((item) => (
          <div className="flex h-full min-w-0 items-end" key={item.rating}>
            <div
              className={
                hasRatings
                  ? "w-full origin-bottom rounded-t-sm bg-primary transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:scale-y-[1.03] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/80"
                  : "h-1 w-full rounded-t-sm bg-muted"
              }
              style={hasRatings ? { height: `${Math.max((item.count / maxCount) * 100, 4)}%` } : undefined}
              title={hasRatings ? `${abbreviateCount(item.count)} ratings at ${item.rating}` : undefined}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3 pt-2 sm:gap-5">
        {ratingDistribution.map((item) => (
          <div className="min-w-0 text-center" key={item.rating}>
            <p className={cn("font-medium text-xs tabular-nums", !hasRatings && "text-muted-foreground")}>
              {item.rating}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/70 tabular-nums">
              {hasRatings ? abbreviateCount(item.count) : "0"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
