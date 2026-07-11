import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactNumber, toFiniteNumber } from "@/lib/format";

export interface StatTrend {
  direction: "down" | "up";
  label: string;
}

interface StatCardProps {
  description: string;
  footnote: string;
  label: string;
  trend?: StatTrend;
  value: number;
}

export function StatCard({ label, value, trend, description, footnote }: StatCardProps) {
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

export function growthTrend(current: number, previous: number): StatTrend | undefined {
  const safeCurrent = toFiniteNumber(current);
  const safePrevious = toFiniteNumber(previous);

  if (safePrevious === 0) {
    return safeCurrent > 0 ? { direction: "up", label: "new" } : undefined;
  }

  const pct = ((safeCurrent - safePrevious) / safePrevious) * 100;
  return { direction: pct >= 0 ? "up" : "down", label: formatGrowth(pct) };
}

export function trendDescription(
  current: number,
  previous: number,
  trend: StatTrend | undefined,
  period: string,
  noun: string
) {
  if (toFiniteNumber(current) === 0 && toFiniteNumber(previous) === 0) {
    return `No ${noun} this ${period}`;
  }
  return trend?.direction === "down" ? `Down this ${period}` : `Trending up this ${period}`;
}

function formatGrowth(pct: number) {
  const safePct = toFiniteNumber(pct);
  return `${safePct >= 0 ? "+" : ""}${safePct.toFixed(1)}%`;
}
