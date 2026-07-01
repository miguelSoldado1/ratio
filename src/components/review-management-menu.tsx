import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { DeleteReviewDialog } from "@/components/delete-review-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

interface ReviewManagementMenuProps {
  canDeleteAsAdmin: boolean;
  canDeleteOwnReview: boolean;
  children?: ReactNode;
  isDeleting: boolean;
  onDelete: () => Promise<boolean>;
}

export function ReviewManagementMenu({
  canDeleteAsAdmin,
  canDeleteOwnReview,
  children,
  isDeleting,
  onDelete,
}: ReviewManagementMenuProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const canDelete = canDeleteOwnReview || canDeleteAsAdmin;

  if (!(children || canDelete)) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Open review actions"
              className="-mr-2 ml-auto"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {children}
            {canDelete ? (
              <DropdownMenuItem disabled={isDeleting} onClick={() => setDeleteDialogOpen(true)} variant="destructive">
                <Trash2 />
                {canDeleteOwnReview ? "Delete review" : "Delete as admin"}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete ? (
        <DeleteReviewDialog
          isDeleting={isDeleting}
          onDelete={onDelete}
          onOpenChange={setDeleteDialogOpen}
          open={deleteDialogOpen}
          variant={canDeleteOwnReview ? "own" : "admin"}
        />
      ) : null}
    </>
  );
}
