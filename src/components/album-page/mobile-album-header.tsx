import { AlbumActions } from "./album-actions";

interface MobileAlbumHeaderAlbum {
  artist: string;
  coverUrl: string;
  release: string;
  runtime: string;
  title: string;
  totalTracks: number;
}

export function MobileAlbumHeader({ album }: { album: MobileAlbumHeaderAlbum }) {
  const albumRuntime = `${album.totalTracks} tracks · ${album.runtime}`;

  return (
    <section className="lg:hidden">
      <div className="grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[144px_1fr]">
        <img
          alt={`${album.title} album cover`}
          className="aspect-square w-full object-cover"
          height={288}
          referrerPolicy="no-referrer"
          src={album.coverUrl}
          width={288}
        />
        <div className="min-w-0 self-end">
          <h1 className="font-semibold text-2xl leading-tight tracking-normal sm:text-3xl">{album.title}</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {album.artist} · {album.release}
          </p>
          <p className="mt-1 text-muted-foreground/70 text-xs">{albumRuntime}</p>
        </div>
      </div>
      <AlbumActions className="mt-5" compact />
    </section>
  );
}
