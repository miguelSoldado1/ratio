import { HeartIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { ReviewActionsMenu } from "./review-actions-menu";
import type { AdminReviewRow } from "@/server/services/review-service";

interface ReviewDetailsDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  review: AdminReviewRow;
}

export function ReviewDetailsDialog({ review, open, onOpenChange }: ReviewDetailsDialogProps) {
  const displayName = review.userDisplayUsername ?? review.username ?? review.userName;
  const username = review.username ? `@${review.username}` : review.userName;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review details</DialogTitle>
          <DialogDescription>Full review and moderation context.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
          <div className="flex items-center gap-3">
            <UserAvatar className="size-9 text-xs" name={displayName} src={review.userImage} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{displayName}</p>
              <p className="truncate text-muted-foreground text-xs">{username}</p>
            </div>
            <p className="shrink-0 text-muted-foreground text-xs">{formatDate(review.createdAt)}</p>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            {review.albumCoverUrl ? (
              <img
                alt=""
                className="size-16 rounded-md object-cover"
                height={64}
                src={review.albumCoverUrl}
                width={64}
              />
            ) : (
              <div aria-hidden className="size-16 shrink-0 rounded-md bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{review.albumTitle}</p>
              <p className="truncate text-muted-foreground text-sm">{review.albumArtistNames.join(", ")}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary">{review.rating / 2} / 5</Badge>
                <Badge variant="outline">
                  <HeartIcon />
                  {formatCompactNumber(review.likeCount)} {review.likeCount === 1 ? "like" : "likes"}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {review.body ? (
            <p className="wrap-break-word whitespace-pre-wrap text-[15px] leading-6">{review.body}</p>
          ) : (
            <p className="text-muted-foreground text-sm">This is a rating-only review with no written body.</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <ReviewActionsMenu onDeleted={() => onOpenChange(false)} review={review} trigger="button" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
