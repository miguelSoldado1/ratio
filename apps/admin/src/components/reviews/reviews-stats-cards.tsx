import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { growthTrend, StatCard, trendDescription } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toFiniteNumber } from "@/lib/format";
import { adminReviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getReviewStats } from "@/server/functions/review-functions";

// These dashboard metrics do not need to refetch on every focus/navigation.
const STATS_STALE_TIME_MS = 5 * 60 * 1000;

export function ReviewsStatsCards() {
  const getStatsFn = useServerFn(getReviewStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: adminReviewQueryKeys.stats(),
    queryFn: () => getStatsFn(),
    staleTime: STATS_STALE_TIME_MS,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          <Skeleton className="h-44 rounded-4xl" key={i} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const totalReviews = toFiniteNumber(stats.totalReviews);
  const newLast7Days = toFiniteNumber(stats.newLast7Days);
  const newLast30Days = toFiniteNumber(stats.newLast30Days);
  const newPrev7Days = toFiniteNumber(stats.newPrev7Days);
  const newPrev30Days = toFiniteNumber(stats.newPrev30Days);
  const writtenReviews = toFiniteNumber(stats.writtenReviews);
  const weeklyTrend = growthTrend(newLast7Days, newPrev7Days);
  const monthlyTrend = growthTrend(newLast30Days, newPrev30Days);
  const writtenShare = totalReviews === 0 ? 0 : (writtenReviews / totalReviews) * 100;

  return (
    <div className="@container/cards grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        description={`+${newLast30Days} in the last 30 days`}
        footnote="All reviews in Ratio"
        label="Total reviews"
        trend={newLast7Days > 0 ? { direction: "up", label: `+${newLast7Days} in 7d` } : undefined}
        value={totalReviews}
      />
      <StatCard
        description={trendDescription(newLast7Days, newPrev7Days, weeklyTrend, "week", "reviews")}
        footnote="Compared to the prior 7 days"
        label="New reviews (7d)"
        trend={weeklyTrend}
        value={newLast7Days}
      />
      <StatCard
        description={trendDescription(newLast30Days, newPrev30Days, monthlyTrend, "month", "reviews")}
        footnote="Compared to the prior 30 days"
        label="New reviews (30d)"
        trend={monthlyTrend}
        value={newLast30Days}
      />
      <StatCard
        description={writtenReviews === 0 ? "No written reviews yet" : `${writtenShare.toFixed(1)}% include text`}
        footnote="Optional text alongside a rating"
        label="Written reviews"
        value={writtenReviews}
      />
    </div>
  );
}
