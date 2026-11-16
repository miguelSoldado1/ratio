import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { growthTrend } from "@/components/stat-card";
import { StatStrip, StatStripSkeleton } from "@/components/stat-strip";
import { toFiniteNumber } from "@/lib/format";
import { adminUserQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserStats } from "@/server/functions/user-functions";

// These dashboard metrics do not need to refetch on every focus/navigation.
const STATS_STALE_TIME_MS = 5 * 60 * 1000;

export function UsersStats() {
  const getStatsFn = useServerFn(getUserStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: adminUserQueryKeys.stats(),
    queryFn: () => getStatsFn(),
    staleTime: STATS_STALE_TIME_MS,
  });

  if (isLoading) return <StatStripSkeleton />;
  if (!stats) return null;

  const totalUsers = toFiniteNumber(stats.totalUsers);
  const newLast7Days = toFiniteNumber(stats.newLast7Days);
  const newLast30Days = toFiniteNumber(stats.newLast30Days);
  const bannedUsers = toFiniteNumber(stats.bannedUsers);
  const bannedShare = totalUsers === 0 ? 0 : (bannedUsers / totalUsers) * 100;

  return (
    <StatStrip
      stats={[
        { hint: "All registered users", label: "Total users", value: totalUsers },
        {
          hint: "vs prior 7 days",
          label: "New users (7d)",
          trend: growthTrend(newLast7Days, toFiniteNumber(stats.newPrev7Days)),
          value: newLast7Days,
        },
        {
          hint: "vs prior 30 days",
          label: "New users (30d)",
          trend: growthTrend(newLast30Days, toFiniteNumber(stats.newPrev30Days)),
          value: newLast30Days,
        },
        { hint: `${bannedShare.toFixed(1)}% of all users`, label: "Banned users", value: bannedUsers },
      ]}
    />
  );
}
