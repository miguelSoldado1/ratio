import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ListManagementMenuProps {
  isDeleting?: boolean;
  onDelete: () => void;
  onRename: () => void;
}

export function ListManagementMenu({ isDeleting = false, onDelete, onRename }: ListManagementMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function handleDeleteClick() {
    setDeleteDialogOpen(false);
    onDelete();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button aria-label="Open list actions" size="icon" type="button" variant="ghost" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="overflow-hidden rounded-xl! p-0">
          <DropdownMenuGroup>
            <DropdownMenuItem className="rounded-none" onClick={onRename}>
              <Pencil />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuSeparator className="mx-0" />
            <DropdownMenuItem
              className="rounded-none"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(true)}
              variant="destructive"
            >
              <Trash2 />
              Delete list
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete this list?</DialogTitle>
            <DialogDescription>
              The albums stay on Ratio, but the list and its order are gone. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isDeleting} onClick={() => setDeleteDialogOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isDeleting} onClick={handleDeleteClick} type="button" variant="destructive">
              Delete list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
