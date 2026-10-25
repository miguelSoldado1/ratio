import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlbumArtwork } from "@/components/album-artwork";
import { SpotifyAttribution } from "@/components/spotify-attribution";
import { spotifyQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getArtistAlbums } from "@/server/functions/spotify-functions";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";

const shelfClassName =
  "-mx-5 mt-2 grid scroll-px-5 auto-cols-[40%] grid-flow-col snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 py-1 [scrollbar-width:none] sm:mx-0 sm:mt-3 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-[repeat(4,minmax(0,7rem))] sm:overflow-visible sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden";

interface MoreFromArtistProps {
  album: Awaited<ReturnType<typeof getAlbumDetails>>["album"];
}

export function MoreFromArtist({ album }: MoreFromArtistProps) {
  const artist = album.artists[0];

  const getArtistAlbumsFn = useServerFn(getArtistAlbums);
  const artistAlbumsQuery = useQuery({
    enabled: Boolean(artist),
    meta: { suppressErrorToast: true },
    queryFn: () => getArtistAlbumsFn({ data: { albumId: album.id, artistId: artist?.id ?? "" } }),
    queryKey: spotifyQueryKeys.artistAlbums(artist?.id ?? "", album.id),
    staleTime: 30 * 60 * 1000,
  });

  const albums = artistAlbumsQuery.data ?? [];
  if (!artist || albums.length === 0) return null;

  return (
    <section aria-label={`More from ${artist.name}`} className="mt-8 border-border/80 border-t pt-8 lg:mt-12">
      <h2 className="heading-section">More from {artist.name}</h2>
      <ul className={shelfClassName}>
        {albums.map((candidate) => (
          <li className="min-w-0 snap-start" key={candidate.id}>
            <Link
              className="focus-ring block rounded-sm transition-opacity hover:opacity-80"
              params={{ albumId: candidate.id }}
              to="/album/$albumId"
            >
              <AlbumArtwork
                alt=""
                className="aspect-square w-full"
                decoding="async"
                height={300}
                loading="lazy"
                src={candidate.coverUrl}
                width={300}
              />
              <span className="mt-2 block truncate font-medium text-sm" title={candidate.title}>
                {candidate.title}
              </span>
            </Link>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-muted-foreground text-xs">
              <span>{candidate.releaseYear}</span>
              <SpotifyAttribution
                ariaLabel={`Open ${candidate.title} on Spotify`}
                className="size-6 justify-center"
                href={candidate.spotifyUrl}
                variant="icon"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
