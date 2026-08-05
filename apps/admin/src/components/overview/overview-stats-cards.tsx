import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { growthTrend, StatCard, trendDescription } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toFiniteNumber } from "@/lib/format";
import { adminOverviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getOverviewStats } from "@/server/functions/overview-functions";

const STATS_STALE_TIME_MS = 5 * 60 * 1000;

export function OverviewStatsCards() {
  const getStatsFn = useServerFn(getOverviewStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: adminOverviewQueryKeys.stats(),
    queryFn: () => getStatsFn(),
    staleTime: STATS_STALE_TIME_MS,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          <Skeleton className="h-44 rounded-4xl" key={index} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const totalUsers = toFiniteNumber(stats.totalUsers);
  const usersLast30Days = toFiniteNumber(stats.usersLast30Days);

  return (
    <div className="@container/cards grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        description={`+${usersLast30Days} in the last 30 days`}
        footnote="All registered users"
        label="Total users"
        trend={usersLast30Days > 0 ? { direction: "up", label: `+${usersLast30Days} in 30d` } : undefined}
        value={totalUsers}
      />
      <PeriodStatCard
        current={stats.usersLast30Days}
        label="New users"
        noun="signups"
        previous={stats.usersPrev30Days}
      />
      <PeriodStatCard
        current={stats.reviewsLast30Days}
        label="Reviews"
        noun="reviews"
        previous={stats.reviewsPrev30Days}
      />
      <PeriodStatCard
        current={stats.repliesLast30Days}
        label="Replies"
        noun="replies"
        previous={stats.repliesPrev30Days}
      />
      <PeriodStatCard current={stats.listsLast30Days} label="Lists" noun="lists" previous={stats.listsPrev30Days} />
      <PeriodStatCard
        current={stats.listItemsLast30Days}
        footnote="Albums still present in lists"
        label="List additions"
        noun="list additions"
        previous={stats.listItemsPrev30Days}
      />
    </div>
  );
}

interface PeriodStatCardProps {
  current: number;
  footnote?: string;
  label: string;
  noun: string;
  previous: number;
}

function PeriodStatCard({
  current,
  footnote = "Compared to the prior 30 days",
  label,
  noun,
  previous,
}: PeriodStatCardProps) {
  const safeCurrent = toFiniteNumber(current);
  const safePrevious = toFiniteNumber(previous);
  const trend = growthTrend(safeCurrent, safePrevious);

  return (
    <StatCard
      description={trendDescription(safeCurrent, safePrevious, trend, "month", noun)}
      footnote={footnote}
      label={`${label} (30d)`}
      trend={trend}
      value={safeCurrent}
    />
  );
}
