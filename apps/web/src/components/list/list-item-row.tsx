import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { GripVertical, Minus } from "lucide-react";
import { AlbumArtwork } from "@/components/album-artwork";
import { ReviewCard } from "@/components/review-card";
import { SpotifyAttribution } from "@/components/spotify-attribution";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listRowClassName } from "./list-row-styles";
import type { ListAlbum } from "@/server/services/list-service";

// Keeps a long list from taking half a second to flip into edit mode.
const removeStaggerMaxSteps = 6;
const removeStaggerStepMs = 22;

// Cover plus the row's vertical padding: side controls centre on the cover, not on a row grown by a review excerpt.
const coverBandClassName = "flex h-20 shrink-0 items-center";

interface ListItemRowProps {
  album: ListAlbum;
  editing: boolean;
  // Not displayed — only sets this row's stagger delay when edit mode opens.
  index: number;
  isRemoving: boolean;
  onRemove: (albumId: string) => void;
  // Set only on numbered lists.
  rank?: number;
  sortingDisabled: boolean;
}

export function ListItemRow({ album, editing, index, isRemoving, onRemove, rank, sortingDisabled }: ListItemRowProps) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform } = useSortable({
    id: album.id,
    disabled: !editing || sortingDisabled,
    transition: null,
  });

  const staggerDelayMs = Math.min(index, removeStaggerMaxSteps) * removeStaggerStepMs;

  return (
    <li
      className={cn(
        "group/list-row relative",
        listRowClassName,
        "items-start",
        isDragging && "z-10 bg-background shadow-md"
      )}
      ref={setNodeRef}
      // Translate only: rows differ in height once review text is shown, and dnd-kit's scale would stretch a row
      // to fill the slot it passes over.
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      {editing ? (
        <div className={coverBandClassName}>
          <Button
            {...attributes}
            {...listeners}
            aria-label={`Drag ${album.title} to reorder`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            ref={setActivatorNodeRef}
            shape="pill"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <GripVertical />
          </Button>
        </div>
      ) : null}
      {rank === undefined ? null : (
        <span
          className={cn(
            coverBandClassName,
            "w-(--rank-width) justify-end font-medium text-muted-foreground text-sm tabular-nums"
          )}
        >
          {rank}
        </span>
      )}
      {/* The title link stretches over the whole row so it opens the album, while the review excerpt
          sits above it as its own link. Like a review card, the excerpt runs full width under the
          cover instead of leaving a hole beneath it. */}
      <div className="relative min-w-0 flex-1 py-3 [transition:opacity_150ms_ease] has-[[data-album-link]:hover]:opacity-80">
        <div className="flex items-center gap-3">
          <AlbumArtwork
            alt={`${album.title} by ${album.artist}`}
            className="size-14"
            decoding="async"
            height={56}
            loading="lazy"
            src={album.coverUrl}
            width={56}
          />
          <span className="min-w-0 flex-1">
            <Link
              className="block truncate font-semibold text-foreground text-sm leading-snug outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-3 focus-visible:after:ring-ring/30"
              data-album-link
              params={{ albumId: album.id }}
              to="/album/$albumId"
            >
              {album.title}
            </Link>
            <span className="mt-0.5 block truncate text-muted-foreground text-xs">
              {album.artist} · {album.year}
            </span>
            {album.authorReview ? <ReviewCard.Rating className="mt-1" value={album.authorReview.rating} /> : null}
          </span>
        </div>
        {album.authorReview?.excerpt ? (
          <Link
            className="focus-ring relative z-10 mt-2 line-clamp-2 rounded-sm text-muted-foreground text-xs leading-relaxed outline-none [transition:color_150ms_ease] hover:text-foreground"
            params={{ reviewId: album.authorReview.id }}
            to="/review/$reviewId"
          >
            {album.authorReview.excerpt}
          </Link>
        ) : null}
      </div>
      <div className={coverBandClassName}>
        {editing && onRemove ? (
          <Button
            aria-label={`Remove ${album.title} from this list`}
            className="shrink-0 starting:scale-90 text-muted-foreground starting:opacity-0 [transition:opacity_160ms_cubic-bezier(0.23,1,0.32,1),transform_160ms_cubic-bezier(0.23,1,0.32,1),color_150ms_ease,background-color_150ms_ease] hover:bg-destructive/10 hover:text-destructive"
            disabled={sortingDisabled || isRemoving}
            onClick={() => onRemove(album.id)}
            shape="pill"
            size="icon-sm"
            style={{ transitionDelay: `${staggerDelayMs}ms` }}
            type="button"
            variant="ghost"
          >
            <Minus />
          </Button>
        ) : (
          <SpotifyAttribution ariaLabel={`Open ${album.title} on Spotify`} href={album.spotifyUrl} variant="icon" />
        )}
      </div>
    </li>
  );
}
