import { AlbumArtwork } from "@/components/album-artwork";
import { cn } from "@/lib/utils";
import type { ListCoverAlbum } from "@/server/services/list-service";

// Below four covers a mosaic would have to crop each one to a non-square slice, which
// looks worse than simply showing the first cover whole.
const mosaicMinAlbums = 4;

export function getLeadingCoverAlbums<T extends ListCoverAlbum>(albums: T[]) {
  return albums.slice(0, mosaicMinAlbums);
}

interface ListCoverMosaicProps {
  albums: ListCoverAlbum[];
  className?: string;
  size: number;
}

export function ListCoverMosaic({ albums, className, size }: ListCoverMosaicProps) {
  const isMosaic = albums.length >= mosaicMinAlbums;
  const tiles = isMosaic ? albums.slice(0, mosaicMinAlbums) : albums.slice(0, 1);
  const tileSize = isMosaic ? Math.round(size / 2) : size;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none grid aspect-square shrink-0 select-none overflow-hidden bg-muted",
        isMosaic && "grid-cols-2 grid-rows-2",
        className
      )}
    >
      {tiles.length === 0 ? (
        <AlbumArtwork alt="" className="size-full" height={size} src={null} width={size} />
      ) : (
        tiles.map((album) => (
          <AlbumArtwork
            alt=""
            className="size-full"
            decoding="async"
            height={tileSize}
            key={album.id}
            loading="lazy"
            src={album.coverUrl}
            width={tileSize}
          />
        ))
      )}
    </span>
  );
}
