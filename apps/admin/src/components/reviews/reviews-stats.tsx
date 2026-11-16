import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { growthTrend } from "@/components/stat-card";
import { StatStrip, StatStripSkeleton } from "@/components/stat-strip";
import { toFiniteNumber } from "@/lib/format";
import { adminReviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getReviewStats } from "@/server/functions/review-functions";

// These dashboard metrics do not need to refetch on every focus/navigation.
const STATS_STALE_TIME_MS = 5 * 60 * 1000;

export function ReviewsStats() {
  const getStatsFn = useServerFn(getReviewStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: adminReviewQueryKeys.stats(),
    queryFn: () => getStatsFn(),
    staleTime: STATS_STALE_TIME_MS,
  });

  if (isLoading) return <StatStripSkeleton />;
  if (!stats) return null;

  const totalReviews = toFiniteNumber(stats.totalReviews);
  const newLast7Days = toFiniteNumber(stats.newLast7Days);
  const newLast30Days = toFiniteNumber(stats.newLast30Days);
  const writtenReviews = toFiniteNumber(stats.writtenReviews);
  const writtenShare = totalReviews === 0 ? 0 : (writtenReviews / totalReviews) * 100;

  return (
    <StatStrip
      stats={[
        { hint: "All reviews in Ratio", label: "Total reviews", value: totalReviews },
        {
          hint: "vs prior 7 days",
          label: "New reviews (7d)",
          trend: growthTrend(newLast7Days, toFiniteNumber(stats.newPrev7Days)),
          value: newLast7Days,
        },
        {
          hint: "vs prior 30 days",
          label: "New reviews (30d)",
          trend: growthTrend(newLast30Days, toFiniteNumber(stats.newPrev30Days)),
          value: newLast30Days,
        },
        { hint: `${writtenShare.toFixed(1)}% include text`, label: "Written reviews", value: writtenReviews },
      ]}
    />
  );
}
