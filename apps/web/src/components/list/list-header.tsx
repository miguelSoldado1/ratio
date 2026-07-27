import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { formatRelativeTimeAgo } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { ListCoverMosaic } from "./list-cover-mosaic";
import { ListShareButton } from "./list-share-button";
import type { ReactNode } from "react";
import type { ListDetails } from "@/server/services/list-service";

interface ListHeaderProps {
  canAddAlbum: boolean;
  className?: string;
  editing: boolean;
  list: ListDetails;
  managementMenu?: ReactNode;
  onAddAlbum: () => void;
  onEditingChange: (editing: boolean) => void;
}

// Mirrors the album header: cover beside a bottom-aligned title block below the two-column
// breakpoint, three descending text levels, then the action row. A list and an album are the same
// kind of page, so they use the same shell.
export function ListHeader({
  canAddAlbum,
  className,
  editing,
  list,
  managementMenu,
  onAddAlbum,
  onEditingChange,
}: ListHeaderProps) {
  const itemCount = list.albums.length;
  const albumLabel = itemCount === 1 ? "album" : "albums";

  return (
    <header className={cn("text-center sm:text-left", className)}>
      {/* Centred stack on phones, the same shape the profile header uses: a 200-character subtitle
          can't sit in a ~220px column beside the cover, and centring the whole block keeps one axis
          instead of a left-aligned title under a centred cover. From sm up this is the album
          header again — cover beside a bottom-aligned title, everything flush left. */}
      <div className="flex flex-col items-center gap-4 sm:grid sm:grid-cols-[144px_1fr] sm:items-end lg:block">
        {/* Cover is shown inline only below the two-column breakpoint; on lg+ it lives in the sticky aside. */}
        <div className="lg:hidden">
          <ListCoverMosaic albums={list.coverAlbums} className="w-44 sm:w-full" size={352} />
        </div>
        <div className="min-w-0 sm:self-end lg:self-auto">
          <h1 className="max-w-4xl font-semibold text-2xl leading-tight tracking-normal sm:text-3xl lg:text-4xl xl:text-5xl">
            {list.title}
          </h1>
        </div>
      </div>
      {list.description ? (
        <p className="wrap-break-word mx-auto mt-3 max-w-2xl text-muted-foreground text-sm sm:mx-0 lg:text-lg">
          {list.description}
        </p>
      ) : null}
      <p className="mt-1.5 text-muted-foreground-subtle text-xs lg:text-sm">
        <Link
          className="focus-ring inline-flex items-center gap-1.5 rounded-sm align-middle outline-none [transition:color_150ms_ease] hover:text-foreground"
          params={{ username: list.author.username }}
          to="/user/$username"
        >
          <UserAvatar className="size-5 text-2xs" name={list.author.displayName} src={list.author.avatarUrl} />
          {list.author.displayName}
        </Link>
        {` · ${itemCount} ${albumLabel} · `}
        {/* "updated" is carried for screen readers only; spelling it out pushes this past one line. */}
        <span className="sr-only">updated </span>
        {formatRelativeTimeAgo(list.updatedAt)}
      </p>
      {/* Primary absorbs the slack so the row can never wrap, the way the album actions grid does. */}
      <div className="mt-5 flex items-center justify-center gap-2 sm:justify-start lg:mt-6 lg:flex-wrap lg:gap-3">
        {list.canEdit ? (
          <>
            <Button
              className="min-w-0 flex-1 lg:flex-none"
              disabled={!canAddAlbum}
              onClick={onAddAlbum}
              size="lg"
              type="button"
              variant={editing ? "outline" : "default"}
            >
              <Plus data-icon="inline-start" />
              {canAddAlbum ? "Add album" : "List full"}
            </Button>
            {itemCount > 0 ? (
              <Button
                onClick={() => onEditingChange(!editing)}
                size="lg"
                type="button"
                variant={editing ? "default" : "outline"}
              >
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
