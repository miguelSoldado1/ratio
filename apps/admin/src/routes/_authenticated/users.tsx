import { createFileRoute } from "@tanstack/react-router";
import { UsersStatsCards } from "@/components/users/users-stats-cards";
import { UsersTable } from "@/components/users/users-table";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading font-semibold text-2xl tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          In here you can manage all your users and their roles. Users with admin role have access to this dashboard.
        </p>
      </div>
      <UsersStatsCards />
      <UsersTable />
    </main>
  );
}
