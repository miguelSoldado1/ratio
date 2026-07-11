import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { growthTrend, StatCard, trendDescription } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toFiniteNumber } from "@/lib/format";
import { adminUserQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserStats } from "@/server/functions/user-functions";

// These dashboard metrics do not need to refetch on every focus/navigation.
const STATS_STALE_TIME_MS = 5 * 60 * 1000;

export function UsersStatsCards() {
  const getStatsFn = useServerFn(getUserStats);

  const { data: stats, isLoading } = useQuery({
    queryKey: adminUserQueryKeys.stats(),
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

  const totalUsers = toFiniteNumber(stats.totalUsers);
  const newLast7Days = toFiniteNumber(stats.newLast7Days);
  const newLast30Days = toFiniteNumber(stats.newLast30Days);
  const newPrev7Days = toFiniteNumber(stats.newPrev7Days);
  const newPrev30Days = toFiniteNumber(stats.newPrev30Days);
  const bannedUsers = toFiniteNumber(stats.bannedUsers);
  const weeklyTrend = growthTrend(newLast7Days, newPrev7Days);
  const monthlyTrend = growthTrend(newLast30Days, newPrev30Days);
  const bannedShare = totalUsers === 0 ? 0 : (bannedUsers / totalUsers) * 100;

  return (
    <div className="@container/cards grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        description={`+${newLast30Days} in the last 30 days`}
        footnote="All registered users"
        label="Total users"
        trend={newLast7Days > 0 ? { direction: "up", label: `+${newLast7Days} in 7d` } : undefined}
        value={totalUsers}
      />
      <StatCard
        description={trendDescription(newLast7Days, newPrev7Days, weeklyTrend, "week", "signups")}
        footnote="Compared to the prior 7 days"
        label="New users (7d)"
        trend={weeklyTrend}
        value={newLast7Days}
      />
      <StatCard
        description={trendDescription(newLast30Days, newPrev30Days, monthlyTrend, "month", "signups")}
        footnote="Compared to the prior 30 days"
        label="New users (30d)"
        trend={monthlyTrend}
        value={newLast30Days}
      />
      <StatCard
        description={bannedUsers === 0 ? "No bans in effect" : `${bannedUsers} active bans`}
        footnote={`${bannedShare.toFixed(1)}% of all users`}
        label="Banned users"
        value={bannedUsers}
      />
    </div>
  );
}
