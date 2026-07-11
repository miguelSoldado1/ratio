import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/lib/format";
import { adminUserQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getUserStats } from "@/server/functions/user-functions";

// These dashboard metrics do not need to refetch on every focus/navigation.
const STATS_STALE_TIME_MS = 5 * 60 * 1000;

interface StatCardProps {
  description: string;
  footnote: string;
  label: string;
  trend?: { direction: "down" | "up"; label: string };
  value: number;
}

function StatCard({ label, value, trend, description, footnote }: StatCardProps) {
  const TrendIcon = trend?.direction === "down" ? TrendingDownIcon : TrendingUpIcon;

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-heading font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
          {formatCompactNumber(value)}
        </CardTitle>
        {trend ? (
          <CardAction>
            <Badge variant="outline">
              <TrendIcon />
              {trend.label}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 font-medium">
          {description}
          {trend ? <TrendIcon className="size-4" /> : null}
        </div>
        <div className="text-muted-foreground">{footnote}</div>
      </CardFooter>
    </Card>
  );
}

function formatGrowth(pct: number) {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function growthTrend(current: number, previous: number): StatCardProps["trend"] {
  const pct = growthPct(current, previous);
  if (pct === null) {
    return current > 0 ? { direction: "up", label: "new" } : undefined;
  }
  return { direction: pct >= 0 ? "up" : "down", label: formatGrowth(pct) };
}

function signupsDescription(current: number, previous: number, trend: StatCardProps["trend"], period: string) {
  if (current === 0 && previous === 0) {
    return `No signups this ${period}`;
  }
  return trend?.direction === "down" ? `Down this ${period}` : `Trending up this ${period}`;
}

function growthPct(current: number, previous: number) {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

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

  const weeklyTrend = growthTrend(stats.newLast7Days, stats.newPrev7Days);
  const monthlyTrend = growthTrend(stats.newLast30Days, stats.newPrev30Days);
  const bannedShare = stats.totalUsers === 0 ? 0 : (stats.bannedUsers / stats.totalUsers) * 100;

  return (
    <div className="@container/cards grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        description={`+${stats.newLast30Days} in the last 30 days`}
        footnote="All registered users"
        label="Total users"
        trend={stats.newLast7Days > 0 ? { direction: "up", label: `+${stats.newLast7Days} in 7d` } : undefined}
        value={stats.totalUsers}
      />
      <StatCard
        description={signupsDescription(stats.newLast7Days, stats.newPrev7Days, weeklyTrend, "week")}
        footnote="Compared to the prior 7 days"
        label="New users (7d)"
        trend={weeklyTrend}
        value={stats.newLast7Days}
      />
      <StatCard
        description={signupsDescription(stats.newLast30Days, stats.newPrev30Days, monthlyTrend, "month")}
        footnote="Compared to the prior 30 days"
        label="New users (30d)"
        trend={monthlyTrend}
        value={stats.newLast30Days}
      />
      <StatCard
        description={stats.bannedUsers === 0 ? "No bans in effect" : `${stats.bannedUsers} active bans`}
        footnote={`${bannedShare.toFixed(1)}% of all users`}
        label="Banned users"
        value={stats.bannedUsers}
      />
    </div>
  );
}
