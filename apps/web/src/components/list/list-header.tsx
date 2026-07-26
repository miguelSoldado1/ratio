import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { formatRelativeTime } from "@/lib/date-format";
import { ListCoverMosaic } from "./list-cover-mosaic";
import { ListShareButton } from "./list-share-button";
import type { ReactNode } from "react";
import type { ListDetails } from "./types";

interface ListHeaderProps {
  className?: string;
  editing: boolean;
  list: ListDetails;
  managementMenu?: ReactNode;
  onAddAlbum: () => void;
  onEditingChange: (editing: boolean) => void;
}

export function ListHeader({ className, editing, list, managementMenu, onAddAlbum, onEditingChange }: ListHeaderProps) {
  const itemCount = list.albums.length;
  const albumLabel = itemCount === 1 ? "album" : "albums";

  return (
    <header className={className}>
      <div className="grid grid-cols-[112px_minmax(0,1fr)] items-end gap-4 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-5 lg:block">
        <ListCoverMosaic albums={list.albums} className="w-full rounded-xl lg:hidden" size={144} />
        <div className="min-w-0 self-end lg:self-auto">
          <h1 className="font-semibold text-2xl leading-tight tracking-normal sm:text-3xl lg:text-4xl xl:text-5xl">
            {list.title}
          </h1>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              className="group press-feedback focus-ring -ml-1.5 flex h-8 min-w-0 items-center gap-2 rounded-full px-1.5 pr-2.5 outline-none hover:bg-primary/10"
              params={{ username: list.author.username }}
              to="/user/$username"
            >
              <UserAvatar className="size-6 text-2xs" name={list.author.displayName} src={list.author.avatarUrl} />
              <span className="truncate font-medium text-foreground/75 text-sm [transition:color_150ms_ease] group-hover:text-primary">
                {list.author.displayName}
              </span>
            </Link>
            <span className="text-muted-foreground text-xs">
              {itemCount} {albumLabel} · updated {formatRelativeTime(list.updatedAt)} ago
            </span>
          </div>
        </div>
      </div>
      {list.description ? (
        <p className="wrap-break-word mt-4 max-w-2xl whitespace-pre-wrap text-[15px] text-foreground/90 leading-[1.45]">
          {list.description}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {list.canEdit ? (
          <>
            <Button onClick={onAddAlbum} type="button" variant={editing ? "outline" : "default"}>
              <Plus data-icon="inline-start" />
              Add album
            </Button>
            {itemCount > 0 ? (
              <Button onClick={() => onEditingChange(!editing)} type="button" variant={editing ? "default" : "outline"}>
                {editing ? <Check data-icon="inline-start" /> : null}
                {editing ? "Done" : "Edit albums"}
              </Button>
            ) : null}
          </>
        ) : null}
        <ListShareButton
          authorDisplayName={list.author.displayName}
          itemCount={itemCount}
          listId={list.id}
          title={list.title}
        />
        {managementMenu}
      </div>
    </header>
  );
}
