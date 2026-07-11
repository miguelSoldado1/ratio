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
import { adminReviewQueryKeys } from "@/lib/tanstack-query/query-keys";
import { tryCatch } from "@/lib/try-catch";
import { cn } from "@/lib/utils";
import { deleteReview } from "@/server/functions/review-functions";
import type { AdminReviewRow } from "@/server/services/review-service";

interface ReviewActionsMenuProps {
  onDeleted?: () => void;
  review: AdminReviewRow;
  trigger?: "button" | "menu";
}

export function ReviewActionsMenu({ review, onDeleted, trigger = "menu" }: ReviewActionsMenuProps) {
  const queryClient = useQueryClient();
  const deleteReviewFn = useServerFn(deleteReview);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMutation = useMutation({ mutationFn: deleteReviewFn });

  async function handleDelete() {
    const { error } = await tryCatch(deleteMutation.mutateAsync({ data: { reviewId: review.id } }));

    if (error) {
      return toast.error("Couldn't delete review", {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
    }

    await queryClient.invalidateQueries({ queryKey: adminReviewQueryKeys.all() });
    setConfirmOpen(false);
    onDeleted?.();
    return toast.success("Review deleted");
  }

  const authorName = review.userDisplayUsername ?? review.username ?? review.userName;

  return (
    <>
      {trigger === "menu" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${authorName}'s review of ${review.albumTitle}`}
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
                Delete review
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
          Delete review
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
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>
              This permanently removes {authorName}&apos;s review of {review.albumTitle}, including its likes. This
              cannot be undone.
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
              Delete review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
