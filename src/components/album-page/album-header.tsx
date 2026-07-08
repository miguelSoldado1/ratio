import { AlbumActions } from "./album-actions";
import { getAlbumArtistNames, getAlbumReleaseYear, getAlbumRuntimeLabel } from "./album-format.ts";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;
type SpotifyAlbum = SpotifyAlbumDetails["album"];

interface AlbumHeaderProps {
  album: SpotifyAlbum;
  className?: string;
  coverUrl: string | null;
}

export function AlbumHeader({ album, className, coverUrl }: AlbumHeaderProps) {
  const artist = getAlbumArtistNames(album);
  const releaseYear = getAlbumReleaseYear(album);
  const albumRuntime = getAlbumRuntimeLabel(album);

  return (
    <section className={className}>
      <div className="grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[144px_1fr] lg:block">
        {/* Cover is shown inline only below the two-column breakpoint; on lg+ it lives in the sticky aside. */}
        <div className="lg:hidden">
          {coverUrl ? (
            <img
              alt={`${album.title} album cover`}
              className="aspect-square w-full object-cover"
              height={288}
              referrerPolicy="no-referrer"
              src={coverUrl}
              width={288}
            />
          ) : (
            <div
              aria-label={`${album.title} album cover unavailable`}
              className="aspect-square w-full bg-muted"
              role="img"
            />
          )}
        </div>
        <div className="min-w-0 self-end lg:self-auto">
          <h1 className="max-w-4xl font-semibold text-2xl leading-tight tracking-normal sm:text-3xl lg:text-4xl xl:text-5xl">
            {album.title}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm lg:text-lg">
            {artist} · {releaseYear}
          </p>
          <p className="mt-1 text-muted-foreground-subtle text-xs lg:text-sm">{albumRuntime}</p>
        </div>
      </div>
      <AlbumActions album={album} className="mt-5 lg:mt-6" />
    </section>
  );
}
