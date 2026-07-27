import { AlertCircle, Check } from "lucide-react";
import { AlbumArtwork } from "@/components/album-artwork";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { AlbumResult } from "./types";

interface AlbumResultItemProps {
  added?: boolean;
  album: AlbumResult;
  dimmed?: boolean;
  disabled?: boolean;
  error?: boolean;
  onSelect: (album: AlbumResult) => void;
  pending?: boolean;
}

export function AlbumResultItem({ added, album, dimmed, disabled, error, onSelect, pending }: AlbumResultItemProps) {
  const artists = album.artists.map((artist) => artist.name).join(", ");

  return (
    <CommandItem
      className={cn("items-center gap-3 py-2.5 transition-opacity", dimmed && "opacity-55")}
      disabled={added || disabled || pending}
      onSelect={() => onSelect(album)}
      value={`album:${album.id}`}
    >
      <AlbumArtwork
        alt={`${album.name} album cover`}
        className={cn("size-10 rounded-md", added && "opacity-45")}
        height={40}
        src={album.image}
        width={40}
      />
      <div className={cn("min-w-0 flex-1 text-left", added && "opacity-55")}>
        <p className="truncate font-medium text-foreground text-sm">{album.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {artists}
          {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ""}
        </p>
      </div>
      {added ? (
        <span className="flex shrink-0 items-center gap-1 font-medium text-primary text-xs">
          <Check />
          Added
        </span>
      ) : null}
      {error ? (
        <span className="flex shrink-0 items-center gap-1 font-medium text-destructive text-xs">
          <AlertCircle />
          Retry
        </span>
      ) : null}
    </CommandItem>
  );
}
