import { createFileRoute } from "@tanstack/react-router";
import { OverviewStatsCards } from "@/components/overview/overview-stats-cards";

export const Route = createFileRoute("/_authenticated/")({
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading font-semibold text-2xl tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">
          Track how the Ratio community is growing and participating over the last 30 days.
        </p>
      </div>
      <OverviewStatsCards />
    </main>
  );
}
