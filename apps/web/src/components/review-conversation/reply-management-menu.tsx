import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { tryCatch } from "@/try-catch";

interface ReplyManagementMenuProps {
  canDeleteAsAdmin: boolean;
  canDeleteOwnReply: boolean;
  isDeleting: boolean;
  onDelete: () => Promise<boolean>;
}

export function ReplyManagementMenu({
  canDeleteAsAdmin,
  canDeleteOwnReply,
  isDeleting,
  onDelete,
}: ReplyManagementMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const canDelete = canDeleteOwnReply || canDeleteAsAdmin;

  if (!canDelete) return null;

  async function handleDeleteClick() {
    const { data: deleted, error } = await tryCatch(onDelete());

    if (!(error || !deleted)) {
      setDeleteDialogOpen(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button aria-label="Open reply actions" size="icon-sm" type="button" variant="ghost" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="overflow-hidden rounded-xl! p-0">
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="rounded-none"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(true)}
              variant="destructive"
            >
              <Trash2 />
              {canDeleteOwnReply ? "Delete reply" : "Delete as admin"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{canDeleteOwnReply ? "Delete your reply?" : "Delete this reply as admin?"}</DialogTitle>
            <DialogDescription>
              {canDeleteOwnReply
                ? "This cannot be undone."
                : "This removes another user's reply from Ratio. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isDeleting} onClick={() => setDeleteDialogOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isDeleting} onClick={handleDeleteClick} type="button" variant="destructive">
              {isDeleting ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
              Delete reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
