import { Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { tryCatch } from "@/try-catch";

interface DeleteReviewDialogProps {
  className?: string;
  isDeleting: boolean;
  onDelete: () => Promise<boolean>;
}

export function DeleteReviewDialog({ className, isDeleting, onDelete }: DeleteReviewDialogProps) {
  const [open, setOpen] = useState(false);

  async function handleDeleteClick() {
    const { data, error } = await tryCatch(onDelete());

    if (!(error || !data)) {
      setOpen(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        aria-label="Delete review"
        className={cn(
          "text-muted-foreground [transition:color_150ms_ease,background-color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]",
          className
        )}
        disabled={isDeleting}
        onClick={() => setOpen(true)}
        size="icon-sm"
        title="Delete review"
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-3.5" />
      </Button>
      <DialogContent className="sm:max-w-95">
        <DialogHeader className="pr-7">
          <DialogTitle>Delete review?</DialogTitle>
          <DialogDescription>This removes your rating, written review, and any likes on it.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isDeleting} onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isDeleting} onClick={handleDeleteClick} type="button" variant="destructive">
            Delete review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
