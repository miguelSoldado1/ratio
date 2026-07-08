import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authProviders } from "@/lib/auth/providers";
import type { AdminUser } from "@/server/services/admin-service";

const adminUsersSkeletonRows = [
  "admin-user-skeleton-1",
  "admin-user-skeleton-2",
  "admin-user-skeleton-3",
  "admin-user-skeleton-4",
  "admin-user-skeleton-5",
  "admin-user-skeleton-6",
];

interface AdminUsersTableProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onSetUserBanned: (user: AdminUser, banned: boolean) => Promise<boolean>;
  pendingBanUserId: string | null;
  totalUsers: number;
  users: AdminUser[];
}

interface AdminUsersToolbarProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
}

interface AdminUserBanDialogProps {
  isPending: boolean;
  onBan: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: AdminUser | null;
}

export function AdminUsersHeader({ totalUsers }: { totalUsers?: number }) {
  return (
    <header className="mb-6 flex flex-col gap-1 border-border border-b pb-5">
      <p className="font-medium text-muted-foreground text-sm">Admin</p>
      <h1 className="font-semibold text-2xl tracking-tight">Users</h1>
      {typeof totalUsers === "number" ? (
        <p className="text-muted-foreground text-sm">{totalUsers.toLocaleString()} total users</p>
      ) : null}
    </header>
  );
}

export function AdminUsersTable({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onSetUserBanned,
  pendingBanUserId,
  totalUsers,
  users,
}: AdminUsersTableProps) {
  const [banDialogUser, setBanDialogUser] = useState<AdminUser | null>(null);

  if (users.length === 0) {
    return <p className="py-6 text-muted-foreground text-sm">No users found.</p>;
  }

  async function handleBanConfirmed() {
    if (!banDialogUser) return;

    const banned = await onSetUserBanned(banDialogUser, true);
    if (banned) {
      setBanDialogUser(null);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Showing {users.length.toLocaleString()} of {totalUsers.toLocaleString()} users
        </p>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Username</TableHead>
              <TableHead>Display name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((userRow) => {
              const isBanPending = pendingBanUserId === userRow.id;

              return (
                <TableRow className="hover:bg-muted/40" key={userRow.id}>
                  <TableCell>
                    {userRow.username ? (
                      <Link
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                        params={{ username: userRow.username }}
                        to="/user/$username"
                      >
                        {userRow.username}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unset</span>
                    )}
                  </TableCell>
                  <TableCell>{userRow.displayName || <span className="text-muted-foreground">Unset</span>}</TableCell>
                  <TableCell>{userRow.email}</TableCell>
                  <TableCell>{formatProviderIds(userRow.providerIds)}</TableCell>
                  <TableCell>{formatDate(userRow.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={userRow.banned ? "destructive" : "secondary"}>
                      {userRow.banned ? "Banned" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>{userRow.role || <span className="text-muted-foreground">User</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {userRow.username ? (
                        <Button
                          render={<Link params={{ username: userRow.username }} target="_blank" to="/user/$username" />}
                          size="sm"
                          variant="outline"
                        >
                          View
                        </Button>
                      ) : null}
                      <Button
                        disabled={isBanPending || !userRow.canBan}
                        onClick={() => (userRow.banned ? onSetUserBanned(userRow, false) : setBanDialogUser(userRow))}
                        size="sm"
                        type="button"
                        variant={userRow.banned ? "outline" : "destructive"}
                      >
                        {userRow.banned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {hasNextPage ? (
          <div className="flex justify-center pt-2">
            <Button disabled={isFetchingNextPage} onClick={onLoadMore} type="button" variant="outline">
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        ) : null}
      </section>
      <AdminUserBanDialog
        isPending={pendingBanUserId === banDialogUser?.id}
        onBan={handleBanConfirmed}
        onOpenChange={(open) => {
          if (!open) {
            setBanDialogUser(null);
          }
        }}
        open={Boolean(banDialogUser)}
        user={banDialogUser}
      />
    </>
  );
}

export function AdminUsersToolbar({ onSearchChange, searchQuery }: AdminUsersToolbarProps) {
  return (
    <div className="mb-5 flex max-w-sm flex-col gap-2">
      <label className="font-medium text-sm" htmlFor="admin-users-search">
        Search users
      </label>
      <Input
        autoComplete="off"
        id="admin-users-search"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Username, name, or email"
        type="search"
        value={searchQuery}
      />
    </div>
  );
}

export function AdminUsersTableSkeleton() {
  return (
    <div aria-label="Loading users" className="flex flex-col gap-3" role="status">
      {adminUsersSkeletonRows.map((rowId) => (
        <Skeleton className="h-12 rounded-md" key={rowId} />
      ))}
    </div>
  );
}

function formatProviderIds(providerIds: string[]) {
  if (providerIds.length === 0) return <span className="text-muted-foreground">Unknown</span>;

  return providerIds.map(formatProviderId).join(", ");
}

function formatProviderId(providerId: string) {
  return authProviders.find((provider) => provider.id === providerId)?.label ?? providerId;
}

function formatDate(value: Date | string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function AdminUserBanDialog({ isPending, onBan, onOpenChange, open, user }: AdminUserBanDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Ban this user?</DialogTitle>
          <DialogDescription>
            {user?.username ? `This will prevent @${user.username} from using Ratio.` : "This user will be banned."} You
            can unban them later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} onClick={onBan} type="button" variant="destructive">
            Ban user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
