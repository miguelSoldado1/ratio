import { createFileRoute } from "@tanstack/react-router";
import { ListsStats } from "@/components/lists/lists-stats";
import { ListsTable } from "@/components/lists/lists-table";

export const Route = createFileRoute("/_authenticated/lists")({
  component: ListsPage,
});

function ListsPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading font-semibold text-2xl tracking-tight">Lists</h1>
        <p className="text-muted-foreground text-sm">
          Browse and moderate album lists. Deleting a list also removes its album entries and cannot be undone.
        </p>
      </div>
      <ListsStats />
      <ListsTable />
    </main>
  );
}
