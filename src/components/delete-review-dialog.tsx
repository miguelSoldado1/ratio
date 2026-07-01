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
import type { ReactNode } from "react";

interface DeleteReviewDialogProps {
  className?: string;
  isDeleting: boolean;
  onDelete: () => Promise<boolean>;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  renderTrigger?: (props: { disabled: boolean; onClick: () => void }) => ReactNode;
  variant?: "admin" | "own";
}

const deleteReviewCopy = {
  admin: {
    description: "This removes another user's review from Ratio. This cannot be undone.",
    title: "Delete this review as admin?",
  },
  own: {
    description: "This cannot be undone.",
    title: "Delete your review?",
  },
};

export function DeleteReviewDialog({
  className,
  isDeleting,
  onDelete,
  onOpenChange,
  open,
  renderTrigger,
  variant = "own",
}: DeleteReviewDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const dialogOpen = open ?? internalOpen;
  const copy = deleteReviewCopy[variant];

  function setDialogOpen(nextOpen: boolean) {
    onOpenChange?.(nextOpen);
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
  }

  async function handleDeleteClick() {
    const { data, error } = await tryCatch(onDelete());

    if (!(error || !data)) {
      setDialogOpen(false);
    }
  }

  return (
    <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
      {renderTrigger ? renderTrigger({ disabled: isDeleting, onClick: () => setDialogOpen(true) }) : null}
      {!renderTrigger && open === undefined ? (
        <Button
          aria-label="Delete review"
          className={cn(
            "text-muted-foreground [transition:color_150ms_ease,background-color_150ms_ease,transform_130ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-destructive/10 hover:text-destructive active:scale-[0.97]",
            className
          )}
          disabled={isDeleting}
          onClick={() => setDialogOpen(true)}
          size="icon-sm"
          title="Delete review"
          type="button"
          variant="ghost"
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
      <DialogContent className="sm:max-w-95">
        <DialogHeader className="pr-7">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isDeleting} onClick={() => setDialogOpen(false)} type="button" variant="outline">
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
