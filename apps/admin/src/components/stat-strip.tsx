import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/lib/format";
import type { StatTrend } from "@/components/stat-card";

export interface StripStat {
  hint: string;
  label: string;
  trend?: StatTrend;
  value: number;
}

interface StatStripProps {
  stats: StripStat[];
}

export function StatStrip({ stats }: StatStripProps) {
  return (
    <Card className="grid grid-cols-2 gap-x-0 gap-y-4 lg:grid-cols-4 lg:divide-x lg:divide-border" size="sm">
      {stats.map((stat) => (
        <StatStripItem key={stat.label} stat={stat} />
      ))}
    </Card>
  );
}

export function StatStripSkeleton() {
  return <Skeleton className="h-46 rounded-4xl lg:h-25" />;
}

function StatStripItem({ stat }: { stat: StripStat }) {
  const TrendIcon = stat.trend?.direction === "down" ? TrendingDownIcon : TrendingUpIcon;

  return (
    <div className="flex min-w-0 flex-col gap-1 px-(--card-spacing)">
      <span className="truncate text-muted-foreground text-xs">{stat.label}</span>
      <div className="flex items-center gap-2">
        <span className="font-heading font-semibold text-xl tabular-nums">{formatCompactNumber(stat.value)}</span>
        {stat.trend ? (
          <Badge variant="outline">
            <TrendIcon />
            {stat.trend.label}
          </Badge>
        ) : null}
      </div>
      <span className="truncate text-muted-foreground text-xs">{stat.hint}</span>
    </div>
  );
}
