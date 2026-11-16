import { cn } from "@/lib/utils";
import type { AdminListCoverAlbum } from "@/server/services/list-service";

interface ListCoverProps {
  albums: AdminListCoverAlbum[];
  className: string;
  size: number;
}

// Same rule as the public app's ListCoverMosaic: a 2x2 grid from four albums, otherwise the first cover.
export function ListCover({ albums, className, size }: ListCoverProps) {
  const isMosaic = albums.length >= 4;
  const tiles = isMosaic ? albums.slice(0, 4) : albums.slice(0, 1);
  const tileSize = isMosaic ? Math.round(size / 2) : size;

  return (
    <div
      aria-hidden
      className={cn("grid shrink-0 overflow-hidden bg-muted", isMosaic && "grid-cols-2 grid-rows-2", className)}
    >
      {tiles.map((album) =>
        album.coverUrl ? (
          <img
            alt=""
            className="size-full object-cover"
            height={tileSize}
            key={album.id}
            src={album.coverUrl}
            width={tileSize}
          />
        ) : (
          <div className="size-full bg-muted" key={album.id} />
        )
      )}
    </div>
  );
}
