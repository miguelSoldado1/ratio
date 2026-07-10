import { AlbumArtwork } from "@/components/album-artwork";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { AlbumResult } from "./types";

interface AlbumResultItemProps {
  album: AlbumResult;
  dimmed?: boolean;
  onSelect: (album: AlbumResult) => void;
}

export function AlbumResultItem({ album, dimmed = false, onSelect }: AlbumResultItemProps) {
  const artists = album.artists.map((artist) => artist.name).join(", ");

  return (
    <CommandItem
      className={cn("items-center gap-3 py-2.5 transition-opacity", dimmed && "opacity-55")}
      onSelect={() => onSelect(album)}
      value={`album:${album.id}`}
    >
      <AlbumArtwork
        alt={`${album.name} album cover`}
        className="size-10 rounded-md"
        height={40}
        src={album.image}
        width={40}
      />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-foreground text-sm">{album.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {artists}
          {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ""}
        </p>
      </div>
    </CommandItem>
  );
}
