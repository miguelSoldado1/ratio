import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { growthTrend } from "@/components/stat-card";
import { StatStrip, StatStripSkeleton } from "@/components/stat-strip";
import { toFiniteNumber } from "@/lib/format";
import { adminListQueryKeys } from "@/lib/tanstack-query/query-keys";
import { statsStaleTime } from "@/lib/tanstack-query/root-provider";
import { getListStats } from "@/server/functions/list-functions";

export function ListsStats() {
  const getStatsFn = useServerFn(getListStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: adminListQueryKeys.stats(),
    queryFn: () => getStatsFn(),
    staleTime: statsStaleTime,
  });

  if (isLoading) return <StatStripSkeleton />;
  if (!stats) return null;

  const totalLists = toFiniteNumber(stats.totalLists);
  const newLast7Days = toFiniteNumber(stats.newLast7Days);
  const newLast30Days = toFiniteNumber(stats.newLast30Days);
  const totalListItems = toFiniteNumber(stats.totalListItems);
  const averageListSize = totalLists === 0 ? 0 : totalListItems / totalLists;

  return (
    <StatStrip
      stats={[
        { hint: "All lists in Ratio", label: "Total lists", value: totalLists },
        {
          hint: "vs prior 7 days",
          label: "New lists (7d)",
          trend: growthTrend(newLast7Days, toFiniteNumber(stats.newPrev7Days)),
          value: newLast7Days,
        },
        {
          hint: "vs prior 30 days",
          label: "New lists (30d)",
          trend: growthTrend(newLast30Days, toFiniteNumber(stats.newPrev30Days)),
          value: newLast30Days,
        },
        { hint: `${averageListSize.toFixed(1)} per list on average`, label: "Listed albums", value: totalListItems },
      ]}
    />
  );
}
