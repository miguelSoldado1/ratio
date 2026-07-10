import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminUsersHeader,
  AdminUsersTable,
  AdminUsersTableSkeleton,
  AdminUsersToolbar,
} from "@/components/admin/admin-users-table";
import { InlineError } from "@/components/inline-error";
import { PageContainer } from "@/components/page-container";
import { useDebounce } from "@/hooks/use-debounce";
import {
  adminQueryKeys,
  albumQueryKeys,
  feedQueryKeys,
  reviewQueryKeys,
  userQueryKeys,
} from "@/lib/tanstack-query/query-keys";
import { listAdminUsers, setAdminUserBan } from "@/server/functions/admin-functions";
import { tryCatch } from "@/try-catch";
import type { AdminUser } from "@/server/services/admin-service";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
  head: () => ({
    meta: [{ title: "Admin Users | Ratio" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const listAdminUsersFn = useServerFn(listAdminUsers);
  const setAdminUserBanFn = useServerFn(setAdminUserBan);
  const [pendingBanUserId, setPendingBanUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery.trim(), 250);
  const usersQuery = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      listAdminUsersFn({
        data: {
          cursor: pageParam ?? undefined,
          query: debouncedSearchQuery || undefined,
        },
      }),
    queryKey: adminQueryKeys.users(debouncedSearchQuery),
  });
  const banMutation = useMutation({
    mutationFn: setAdminUserBanFn,
  });

  const users = usersQuery.data?.pages.flatMap((page) => page.users) ?? [];
  const totalUsers = usersQuery.data?.pages[0]?.totalUsers ?? 0;

  async function handleSetUserBanned(user: AdminUser, banned: boolean) {
    setPendingBanUserId(user.id);
    const { error } = await tryCatch(banMutation.mutateAsync({ data: { banned, userId: user.id } }));

    if (error) {
      setPendingBanUserId(null);
      toast.error(banned ? "Couldn't ban user" : "Couldn't unban user", {
        description: error.message || "Something went wrong. Try again.",
      });

      return false;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.users() }),
      queryClient.invalidateQueries({ queryKey: albumQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: feedQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: userQueryKeys.all() }),
    ]);

    setPendingBanUserId(null);
    toast.success(banned ? "User banned" : "User unbanned");

    return true;
  }

  if (usersQuery.isPending) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer className="max-w-6xl">
          <AdminUsersHeader />
          <AdminUsersToolbar onSearchChange={setSearchQuery} searchQuery={searchQuery} />
          <AdminUsersTableSkeleton />
        </PageContainer>
      </main>
    );
  }

  if (usersQuery.isError) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer className="max-w-6xl">
          <AdminUsersHeader />
          <AdminUsersToolbar onSearchChange={setSearchQuery} searchQuery={searchQuery} />
          <InlineError
            className="py-6"
            description="You need an admin role to view this page."
            title="Users unavailable"
          />
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PageContainer className="max-w-6xl">
        <AdminUsersHeader totalUsers={totalUsers} />
        <AdminUsersToolbar onSearchChange={setSearchQuery} searchQuery={searchQuery} />
        <AdminUsersTable
          hasNextPage={usersQuery.hasNextPage}
          isFetchingNextPage={usersQuery.isFetchingNextPage}
          onLoadMore={() => usersQuery.fetchNextPage()}
          onSetUserBanned={handleSetUserBanned}
          pendingBanUserId={pendingBanUserId}
          totalUsers={totalUsers}
          users={users}
        />
      </PageContainer>
    </main>
  );
}
