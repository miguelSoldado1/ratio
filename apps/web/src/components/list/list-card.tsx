import { Link } from "@tanstack/react-router";
import { UserAvatar } from "@/components/user-avatar";
import { formatRelativeTime } from "@/lib/date-format";
import { ListCoverMosaic } from "./list-cover-mosaic";
import type { ListSummary } from "@/server/services/list-service";

interface ListCardProps {
  list: ListSummary;
}

export function ListCard({ list }: ListCardProps) {
  const albumLabel = list.itemCount === 1 ? "album" : "albums";

  return (
    <li className="border-border border-b py-4 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <Link
          className="group press-feedback -ml-1.5 flex h-8 min-w-0 items-center gap-2 rounded-full px-1.5 pr-2.5 hover:bg-primary/10"
          params={{ username: list.author.username }}
          to="/user/$username"
        >
          <UserAvatar className="size-6 text-2xs" name={list.author.displayName} src={list.author.avatarUrl} />
          <span className="truncate font-medium text-foreground/75 text-sm transition-colors group-hover:text-primary">
            {list.author.displayName}
          </span>
        </Link>
        <time className="text-muted-foreground text-xs" dateTime={list.updatedAt.toISOString()}>
          <span className="sr-only">updated </span>
          {formatRelativeTime(list.updatedAt)}
        </time>
      </div>
      <Link
        className="focus-ring flex min-w-0 items-center gap-3 rounded-sm outline-none [transition:opacity_150ms_ease] hover:opacity-80"
        params={{ listId: list.id }}
        to="/list/$listId"
      >
        <ListCoverMosaic albums={list.coverAlbums} className="size-14" size={112} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground text-sm leading-snug">{list.title}</span>
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            {list.itemCount} {albumLabel}
          </span>
        </span>
      </Link>
    </li>
  );
}
