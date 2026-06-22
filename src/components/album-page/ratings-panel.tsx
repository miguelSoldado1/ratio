import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ReviewCard } from "@/components/review-card";
import { Skeleton } from "@/components/ui/skeleton";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import { getAlbumRatingSummary } from "@/server/functions/review-functions";
import { RatingDistributionChart } from "./rating-distribution-chart";

const emptyRatingDistribution = [
  { count: 0, rating: "1" },
  { count: 0, rating: "2" },
  { count: 0, rating: "3" },
  { count: 0, rating: "4" },
  { count: 0, rating: "5" },
] satisfies Awaited<ReturnType<typeof getAlbumRatingSummary>>["ratingDistribution"];

const ratingBarSkeletons = [
  { height: 36, id: "rating-bar-1" },
  { height: 58, id: "rating-bar-2" },
  { height: 84, id: "rating-bar-3" },
  { height: 68, id: "rating-bar-4" },
  { height: 44, id: "rating-bar-5" },
] as const;

const ratingLabelSkeletons = ["rating-label-1", "rating-label-2", "rating-label-3", "rating-label-4", "rating-label-5"];

interface RatingsPanelProps {
  albumId: string;
  className?: string;
}

export function RatingsPanel({ albumId, className }: RatingsPanelProps) {
  const getAlbumRatingSummaryFn = useServerFn(getAlbumRatingSummary);
  const albumRatingSummaryQuery = useQuery({
    queryFn: () => getAlbumRatingSummaryFn({ data: { albumId } }),
    queryKey: albumQueryKeys.ratingSummary(albumId),
  });

  if (albumRatingSummaryQuery.isPending) {
    return <RatingsPanelSkeleton className={className} />;
  }

  if (albumRatingSummaryQuery.isError) {
    return (
      <section aria-label="Album ratings unavailable" className={cn("border-border border-t py-5", className)}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <p className="font-medium text-base">Ratings unavailable</p>
          <p className="text-muted-foreground text-sm tabular-nums">0 ratings</p>
        </div>
        <RatingDistributionChart ratingDistribution={emptyRatingDistribution} />
      </section>
    );
  }

  const albumRatingSummary = albumRatingSummaryQuery.data;
  const ratingDistribution = albumRatingSummary?.ratingDistribution ?? emptyRatingDistribution;
  const ratingSummary = albumRatingSummary?.ratingSummary ?? null;
  const hasRatings = ratingSummary !== null && ratingDistribution.some((item) => item.count > 0);

  return (
    <section aria-label="Album ratings" className={cn("border-border border-t py-5", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          {hasRatings ? (
            <ReviewCard.Rating
              className="**:data-[slot=rating-star-icon]:size-5.5 **:data-[slot=rating-star-value]:text-lg"
              value={ratingSummary.average}
            />
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

export function RatingsPanelSkeleton({ className }: { className?: string }) {
  return (
    <section aria-label="Loading album ratings" className={cn("border-border border-t py-5", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="grid h-32 grid-cols-5 items-end gap-3 border-border border-b pb-2 sm:h-40 sm:gap-5">
        {ratingBarSkeletons.map((bar) => (
          <div className="flex h-full min-w-0 items-end" key={bar.id}>
            <Skeleton className="w-full rounded-t-sm rounded-b-none" style={{ height: `${bar.height}%` }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3 pt-2 sm:gap-5">
        {ratingLabelSkeletons.map((labelId) => (
          <div className="flex min-w-0 flex-col items-center gap-2" key={labelId}>
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-2 w-7" />
          </div>
        ))}
      </div>
    </section>
  );
}
