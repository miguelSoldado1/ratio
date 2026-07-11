import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckCircle2Icon, MoreHorizontalIcon, ShieldIcon, ShieldOffIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { authClient } from "@/lib/auth-client";
import { hasAdminRole, withAdminRole, withoutAdminRole } from "@/lib/roles";
import { adminUserQueryKeys } from "@/lib/tanstack-query/query-keys";
import { tryCatch } from "@/lib/try-catch";
import { cn } from "@/lib/utils";
import type { AdminUserRow } from "@/server/services/user-service";

type UserAction = "ban" | "delete" | "demote" | "promote" | "unban";

interface ActionCopy {
  confirmLabel: string;
  confirmVariant: "default" | "destructive";
  description: string;
  errorTitle: string;
  successTitle: string;
  title: (name: string) => string;
}

const actionCopy: Record<Exclude<UserAction, "unban">, ActionCopy> = {
  ban: {
    title: (name) => `Ban ${name}?`,
    description:
      "This will prevent the user from using Ratio and revoke their active sessions. You can unban them later.",
    confirmLabel: "Ban user",
    confirmVariant: "destructive",
    successTitle: "User banned",
    errorTitle: "Couldn't ban user",
  },
  delete: {
    title: (name) => `Delete ${name}?`,
    description:
      "This permanently deletes the user along with all their reviews, likes, follows and notifications. This cannot be undone.",
    confirmLabel: "Delete user",
    confirmVariant: "destructive",
    successTitle: "User deleted",
    errorTitle: "Couldn't delete user",
  },
  promote: {
    title: (name) => `Make ${name} an admin?`,
    description: "Admins have full access to this dashboard, including managing other users.",
    confirmLabel: "Make admin",
    confirmVariant: "default",
    successTitle: "User is now an admin",
    errorTitle: "Couldn't update role",
  },
  demote: {
    title: (name) => `Remove admin from ${name}?`,
    description: "The user will lose access to this dashboard.",
    confirmLabel: "Remove admin",
    confirmVariant: "destructive",
    successTitle: "Admin role removed",
    errorTitle: "Couldn't update role",
  },
};

export function UserActionsMenu({ user }: { user: AdminUserRow }) {
  const queryClient = useQueryClient();
  const { data: access } = useAdminAccess();
  const [confirmAction, setConfirmAction] = useState<Exclude<UserAction, "unban"> | null>(null);

  const isSelf = access != null && access.status !== "unauthenticated" && access.user.id === user.id;
  const isAdmin = hasAdminRole(user.role);

  async function performAction(action: UserAction) {
    switch (action) {
      case "ban":
        return (await authClient.admin.banUser({ userId: user.id })).error;
      case "unban":
        return (await authClient.admin.unbanUser({ userId: user.id })).error;
      case "promote":
        return (
          await authClient.admin.setRole({
            userId: user.id,
            // Better Auth's default client types do not model preserved custom roles.
            role: withAdminRole(user.role) as ("admin" | "user")[],
          })
        ).error;
      case "demote":
        return (
          await authClient.admin.setRole({
            userId: user.id,
            // Better Auth's default client types do not model preserved custom roles.
            role: withoutAdminRole(user.role) as ("admin" | "user")[],
          })
        ).error;
      case "delete":
        return (await authClient.admin.removeUser({ userId: user.id })).error;
      default:
        throw new Error(`Unsupported user action: ${action satisfies never}`);
    }
  }

  const actionMutation = useMutation({ mutationFn: performAction });

  async function runAction(action: UserAction) {
    const errorTitle = action === "unban" ? "Couldn't unban user" : actionCopy[action].errorTitle;
    const { data: responseError, error } = await tryCatch(actionMutation.mutateAsync(action));

    if (error) {
      toast.error(errorTitle, {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
      return;
    }

    if (responseError) {
      toast.error(errorTitle, { description: responseError.message ?? "Something went wrong. Try again." });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: adminUserQueryKeys.all() });
    setConfirmAction(null);
    toast.success(action === "unban" ? "User unbanned" : actionCopy[action].successTitle);
  }

  const copy = confirmAction ? actionCopy[confirmAction] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${user.name}`}
          className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "rounded-xl")}
          disabled={actionMutation.isPending}
          type="button"
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-36 rounded-xl p-1" sideOffset={6}>
          <DropdownMenuGroup>
            {isAdmin ? (
              <DropdownMenuItem
                className="rounded-lg px-2.5 py-1.5"
                disabled={isSelf}
                onClick={() => setConfirmAction("demote")}
              >
                <ShieldOffIcon />
                Remove admin
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="rounded-lg px-2.5 py-1.5" onClick={() => setConfirmAction("promote")}>
                <ShieldIcon />
                Make admin
              </DropdownMenuItem>
            )}
            {user.banned ? (
              <DropdownMenuItem
                className="rounded-lg px-2.5 py-1.5"
                disabled={actionMutation.isPending}
                onClick={() => runAction("unban")}
              >
                <CheckCircle2Icon />
                Unban user
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="rounded-lg px-2.5 py-1.5"
                disabled={isSelf}
                onClick={() => setConfirmAction("ban")}
                variant="destructive"
              >
                <BanIcon />
                Ban user
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="rounded-lg px-2.5 py-1.5"
              disabled={isSelf}
              onClick={() => setConfirmAction("delete")}
              variant="destructive"
            >
              <Trash2Icon />
              Delete user
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        onOpenChange={(open) => {
          if (open || actionMutation.isPending) return;
          setConfirmAction(null);
        }}
        open={confirmAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title(user.name)}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={actionMutation.isPending}
              onClick={() => setConfirmAction(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={actionMutation.isPending}
              onClick={() => confirmAction && runAction(confirmAction)}
              type="button"
              variant={copy?.confirmVariant}
            >
              {actionMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {copy?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
