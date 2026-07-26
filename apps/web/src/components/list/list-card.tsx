import { Link } from "@tanstack/react-router";
import { formatRelativeTime } from "@/lib/date-format";
import { ListCoverMosaic } from "./list-cover-mosaic";
import { listRowClassName } from "./list-item-row";
import type { ListSummary } from "./types";

interface ListCardProps {
  list: ListSummary;
}

export function ListCard({ list }: ListCardProps) {
  const albumLabel = list.itemCount === 1 ? "album" : "albums";

  return (
    <li className={listRowClassName}>
      <Link
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-sm py-3 outline-none [transition:opacity_150ms_ease] hover:opacity-80 sm:gap-4"
        params={{ listId: list.id }}
        to="/list/$listId"
      >
        <ListCoverMosaic albums={list.coverAlbums} className="size-20 rounded-lg sm:size-24" size={192} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground text-sm leading-snug sm:text-base">
            {list.title}
          </span>
          {list.description ? (
            <span className="mt-1 block truncate text-muted-foreground text-xs sm:text-sm">{list.description}</span>
          ) : null}
          <span className="mt-1 block truncate text-muted-foreground-subtle text-xs">
            updated {formatRelativeTime(list.updatedAt)} ago
          </span>
        </span>
        {/* Sits where a review card puts its rating, so both profile tabs share one skeleton. */}
        <span className="flex shrink-0 items-baseline gap-1 pl-3">
          <span className="font-semibold text-foreground text-sm tabular-nums">{list.itemCount}</span>
          <span className="text-muted-foreground text-xs">{albumLabel}</span>
        </span>
      </Link>
    </li>
  );
}
