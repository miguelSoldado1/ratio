import { cn } from "@/lib/utils";
import type { AdminListCoverAlbum } from "@/server/services/list-service";

interface ListCoverProps {
  albums: AdminListCoverAlbum[];
  className: string;
  coverUrl: string | null;
  size: number;
}

// Same rule as the public app's ListCoverMosaic: an uploaded cover wins, then a 2x2 grid from four
// albums, otherwise the first cover.
export function ListCover({ albums, className, coverUrl, size }: ListCoverProps) {
  const isMosaic = !coverUrl && albums.length >= 4;
  const tiles = getCoverTiles(albums, coverUrl, isMosaic);
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

function getCoverTiles(albums: AdminListCoverAlbum[], coverUrl: string | null, isMosaic: boolean) {
  if (coverUrl) return [{ coverUrl, id: coverUrl }];

  return isMosaic ? albums.slice(0, 4) : albums.slice(0, 1);
}
