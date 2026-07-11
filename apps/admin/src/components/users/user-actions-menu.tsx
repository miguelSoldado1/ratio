import { useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckCircle2Icon, MoreHorizontalIcon } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { adminQueryKeys } from "@/lib/tanstack-query/query-keys";
import { cn } from "@/lib/utils";
import type { AdminUserRow } from "@/server/services/users-service";

export function UserActionsMenu({ user }: { user: AdminUserRow }) {
  const queryClient = useQueryClient();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function updateBanStatus(banned: boolean) {
    setIsPending(true);

    try {
      const response = banned
        ? await authClient.admin.banUser({ userId: user.id })
        : await authClient.admin.unbanUser({ userId: user.id });

      if (response.error) {
        toast.error(banned ? "Couldn't ban user" : "Couldn't unban user", {
          description: response.error.message ?? "Something went wrong. Try again.",
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users.all() });
      setBanDialogOpen(false);
      toast.success(banned ? "User banned" : "User unbanned");
    } catch (error) {
      toast.error(banned ? "Couldn't ban user" : "Couldn't unban user", {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${user.name}`}
          className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "rounded-xl")}
          type="button"
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-36 rounded-xl p-1" sideOffset={6}>
          <DropdownMenuGroup>
            {user.banned ? (
              <DropdownMenuItem
                className="rounded-lg px-2.5 py-1.5"
                disabled={isPending}
                onClick={() => updateBanStatus(false)}
              >
                <CheckCircle2Icon />
                Unban user
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="rounded-lg px-2.5 py-1.5"
                onClick={() => setBanDialogOpen(true)}
                variant="destructive"
              >
                <BanIcon />
                Ban user
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog onOpenChange={setBanDialogOpen} open={banDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {user.name}?</DialogTitle>
            <DialogDescription>
              This will prevent the user from using Ratio and revoke their active sessions. You can unban them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isPending} onClick={() => setBanDialogOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isPending} onClick={() => updateBanStatus(true)} type="button" variant="destructive">
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Ban user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
