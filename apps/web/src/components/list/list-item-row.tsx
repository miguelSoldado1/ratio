import { Link } from "@tanstack/react-router";
import { Minus } from "lucide-react";
import { AlbumArtwork } from "@/components/album-artwork";
import { SpotifyAttribution } from "@/components/spotify-attribution";
import { Button } from "@/components/ui/button";
import { formatCalendarDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import type { ListAlbum } from "@/server/services/list-service";

// Keeps a long list from taking half a second to flip into edit mode.
const removeStaggerMaxSteps = 6;
const removeStaggerStepMs = 22;

// Shared with the empty-list add row so both keep the same rhythm.
export const listRowClassName = "flex items-center gap-3 border-border border-b last:border-b-0 sm:gap-4";

interface ListItemRowProps {
  album: ListAlbum;
  className?: string;
  editing?: boolean;
  // Not displayed — only sets this row's stagger delay when edit mode opens.
  index: number;
  isRemoving?: boolean;
  onRemove?: (albumId: string) => void;
}

export function ListItemRow({
  album,
  className,
  editing = false,
  index,
  isRemoving = false,
  onRemove,
}: ListItemRowProps) {
  const staggerDelayMs = Math.min(index, removeStaggerMaxSteps) * removeStaggerStepMs;
  const addedAtLabel = `Added ${formatCalendarDate(album.addedAt)}`;

  return (
    <li className={cn("group/list-row", listRowClassName, className)}>
      <Link
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-sm py-3 outline-none [transition:opacity_150ms_ease] hover:opacity-80"
        params={{ albumId: album.id }}
        to="/album/$albumId"
      >
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
          <span className="block truncate font-semibold text-foreground text-sm leading-snug">{album.title}</span>
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            {album.artist} · {album.year}
          </span>
          <time className="mt-1 block text-[11px] text-muted-foreground/70" dateTime={album.addedAt.toISOString()}>
            {addedAtLabel}
          </time>
        </span>
      </Link>
      {editing && onRemove ? (
        <Button
          aria-label={`Remove ${album.title} from this list`}
          className="shrink-0 starting:scale-90 text-muted-foreground starting:opacity-0 [transition:opacity_160ms_cubic-bezier(0.23,1,0.32,1),transform_160ms_cubic-bezier(0.23,1,0.32,1),color_150ms_ease,background-color_150ms_ease] hover:bg-destructive/10 hover:text-destructive"
          disabled={isRemoving}
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
    </li>
  );
}
