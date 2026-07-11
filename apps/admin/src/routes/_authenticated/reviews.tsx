import { createFileRoute } from "@tanstack/react-router";
import { ReviewsStatsCards } from "@/components/reviews/reviews-stats-cards";
import { ReviewsTable } from "@/components/reviews/reviews-table";

export const Route = createFileRoute("/_authenticated/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading font-semibold text-2xl tracking-tight">Reviews</h1>
        <p className="text-muted-foreground text-sm">
          Browse and moderate album reviews. Deleting a review also removes its likes and cannot be undone.
        </p>
      </div>
      <ReviewsStatsCards />
      <ReviewsTable />
    </main>
  );
}
