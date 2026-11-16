import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
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
import { adminListQueryKeys } from "@/lib/tanstack-query/query-keys";
import { tryCatch } from "@/lib/try-catch";
import { cn } from "@/lib/utils";
import { deleteList } from "@/server/functions/list-functions";
import type { AdminListRow } from "@/server/services/list-service";

interface ListActionsMenuProps {
  list: AdminListRow;
  onDeleted?: () => void;
  trigger?: "button" | "menu";
}

export function ListActionsMenu({ list, onDeleted, trigger = "menu" }: ListActionsMenuProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteListFn = useServerFn(deleteList);
  const deleteMutation = useMutation({ mutationFn: deleteListFn });

  async function handleDelete() {
    const { error } = await tryCatch(deleteMutation.mutateAsync({ data: { listId: list.id } }));

    if (error) {
      return toast.error("Couldn't delete list", {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
    }

    await queryClient.invalidateQueries({ queryKey: adminListQueryKeys.all() });
    setConfirmOpen(false);
    onDeleted?.();
    return toast.success("List deleted");
  }

  const ownerName = list.userDisplayUsername ?? list.username ?? list.userName;

  return (
    <>
      {trigger === "menu" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${ownerName}'s list ${list.title}`}
            className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "rounded-xl")}
            disabled={deleteMutation.isPending}
            type="button"
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto min-w-36 rounded-xl p-1" sideOffset={6}>
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="rounded-lg px-2.5 py-1.5"
                onClick={() => setConfirmOpen(true)}
                variant="destructive"
              >
                <Trash2Icon />
                Delete list
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          disabled={deleteMutation.isPending}
          onClick={() => setConfirmOpen(true)}
          type="button"
          variant="destructive"
        >
          <Trash2Icon data-icon="inline-start" />
          Delete list
        </Button>
      )}
      <Dialog
        onOpenChange={(open) => {
          if (open || deleteMutation.isPending) return;
          setConfirmOpen(false);
        }}
        open={confirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this list?</DialogTitle>
            <DialogDescription>
              This permanently removes {ownerName}&apos;s list &ldquo;{list.title}&rdquo;, including its album entries.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => setConfirmOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={deleteMutation.isPending} onClick={handleDelete} type="button" variant="destructive">
              {deleteMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Delete list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
