import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { growthTrend, StatCard, trendDescription } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toFiniteNumber } from "@/lib/format";
import { adminListQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getListStats } from "@/server/functions/list-functions";

// These dashboard metrics do not need to refetch on every focus/navigation.
const STATS_STALE_TIME_MS = 5 * 60 * 1000;

export function ListsStatsCards() {
  const getStatsFn = useServerFn(getListStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: adminListQueryKeys.stats(),
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

  const totalLists = toFiniteNumber(stats.totalLists);
  const newLast7Days = toFiniteNumber(stats.newLast7Days);
  const newLast30Days = toFiniteNumber(stats.newLast30Days);
  const newPrev7Days = toFiniteNumber(stats.newPrev7Days);
  const newPrev30Days = toFiniteNumber(stats.newPrev30Days);
  const totalListItems = toFiniteNumber(stats.totalListItems);
  const weeklyTrend = growthTrend(newLast7Days, newPrev7Days);
  const monthlyTrend = growthTrend(newLast30Days, newPrev30Days);
  const averageListSize = totalLists === 0 ? 0 : totalListItems / totalLists;

  return (
    <div className="@container/cards grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        description={`+${newLast30Days} in the last 30 days`}
        footnote="All lists in Ratio"
        label="Total lists"
        trend={newLast7Days > 0 ? { direction: "up", label: `+${newLast7Days} in 7d` } : undefined}
        value={totalLists}
      />
      <StatCard
        description={trendDescription(newLast7Days, newPrev7Days, weeklyTrend, "week", "lists")}
        footnote="Compared to the prior 7 days"
        label="New lists (7d)"
        trend={weeklyTrend}
        value={newLast7Days}
      />
      <StatCard
        description={trendDescription(newLast30Days, newPrev30Days, monthlyTrend, "month", "lists")}
        footnote="Compared to the prior 30 days"
        label="New lists (30d)"
        trend={monthlyTrend}
        value={newLast30Days}
      />
      <StatCard
        description={totalLists === 0 ? "No lists yet" : `${averageListSize.toFixed(1)} albums per list on average`}
        footnote="Album entries across every list"
        label="Listed albums"
        value={totalListItems}
      />
    </div>
  );
}
