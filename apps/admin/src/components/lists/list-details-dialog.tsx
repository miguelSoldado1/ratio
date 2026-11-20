import { DiscIcon, ExternalLinkIcon } from "lucide-react";
import { ListCover } from "@/components/lists/list-cover";
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
import { getWebAppHref } from "@/lib/web-app";
import { ListActionsMenu } from "./list-actions-menu";
import type { AdminListRow } from "@/server/services/list-service";

interface ListDetailsDialogProps {
  list: AdminListRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function ListDetailsDialog({ list, open, onOpenChange }: ListDetailsDialogProps) {
  const displayName = list.userDisplayUsername ?? list.username ?? list.userName;
  const username = list.username ? `@${list.username}` : list.userName;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>List details</DialogTitle>
          <DialogDescription>Full list and moderation context.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
          <div className="flex items-center gap-3">
            <UserAvatar className="size-9 text-xs" name={displayName} src={list.userImage} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{displayName}</p>
              <p className="truncate text-muted-foreground text-xs">{username}</p>
            </div>
            <p className="shrink-0 text-muted-foreground text-xs">{formatDate(list.createdAt)}</p>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <ListCover albums={list.coverAlbums} className="size-16 rounded-md" coverUrl={list.coverUrl} size={64} />
            <div className="min-w-0 flex-1">
              <a
                className="group inline-flex max-w-full items-center gap-1.5 rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={getWebAppHref(`/list/${encodeURIComponent(list.id)}`)}
                rel="noreferrer"
                target="_blank"
              >
                <span className="truncate">{list.title}</span>
                <ExternalLinkIcon
                  aria-hidden
                  className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </a>
              <p className="truncate text-muted-foreground text-sm">Updated {formatDate(list.updatedAt)}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">
                  <DiscIcon />
                  {formatCompactNumber(list.itemCount)} {list.itemCount === 1 ? "album" : "albums"}
                </Badge>
                {list.isRanked ? <Badge variant="secondary">Numbered</Badge> : null}
              </div>
            </div>
          </div>

          <Separator />

          {list.description ? (
            <p className="wrap-break-word whitespace-pre-wrap text-[15px] leading-6">{list.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm">This list has no description.</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <ListActionsMenu list={list} onDeleted={() => onOpenChange(false)} trigger="button" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
