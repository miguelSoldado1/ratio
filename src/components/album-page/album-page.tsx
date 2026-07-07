import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlbumActions } from "@/components/album-page/album-actions";
import {
  getAlbumArtistNames,
  getAlbumReleaseYear,
  getAlbumRuntimeLabel,
} from "@/components/album-page/album-format.ts";
import { AlbumLookupLoading } from "@/components/album-page/album-lookup-loading";
import { MobileAlbumHeader } from "@/components/album-page/mobile-album-header";
import { RatingsPanel } from "@/components/album-page/ratings-panel";
import { ReviewsSection } from "@/components/album-page/reviews-section";
import { TrackList } from "@/components/album-page/track-list";
import { InlineError } from "@/components/inline-error";
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getAlbumDetails } from "@/server/functions/spotify-functions";

interface AlbumPageProps {
  albumId: string;
}

export function AlbumPage({ albumId }: AlbumPageProps) {
  const getAlbumDetailsFn = useServerFn(getAlbumDetails);
  const albumDetailsQuery = useQuery({
    queryFn: () => getAlbumDetailsFn({ data: { albumId } }),
    queryKey: albumQueryKeys.details(albumId),
  });

  if (albumDetailsQuery.isPending) return <AlbumLookupLoading albumId={albumId} />;
  if (albumDetailsQuery.isError) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto w-full max-w-375 px-5 py-12 lg:px-10 xl:px-14 2xl:px-20">
          <InlineError
            description="Could not load this album. It may be unavailable on Spotify or temporarily unreachable."
            title="Album unavailable"
          />
        </div>
      </main>
    );
  }

  const { album, tracks } = albumDetailsQuery.data;
  const artist = getAlbumArtistNames(album);
  const releaseYear = getAlbumReleaseYear(album);
  const albumRuntime = getAlbumRuntimeLabel(album);

  return (
    <main className="min-h-screen bg-background text-foreground" data-album-id={album.id}>
      <div className="mx-auto grid w-full max-w-375 gap-8 px-5 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] lg:px-10 xl:gap-12 xl:px-14 2xl:px-20">
        <MobileAlbumHeader album={album} coverUrl={album.coverUrl} />
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <AlbumCover albumTitle={album.title} coverUrl={album.coverUrl} />
          <TrackList className="mt-6" tracks={tracks} />
        </aside>
        <section className="min-w-0 pt-3 lg:pt-10">
          <div className="hidden lg:block">
            <h1 className="heading-page max-w-4xl">{album.title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {artist} · {releaseYear}
            </p>
            <p className="mt-1 text-muted-foreground-subtle text-sm">{albumRuntime}</p>

            <AlbumActions album={album} className="mt-6" />
          </div>
          <RatingsPanel albumId={album.id} className="mt-2 lg:mt-8" />
          <ReviewsSection album={album} className="mt-10 lg:mt-12" />
        </section>
      </div>
    </main>
  );
}

interface AlbumCoverProps {
  albumTitle: string;
  coverUrl: string | null;
}

function AlbumCover({ albumTitle, coverUrl }: AlbumCoverProps) {
  if (!coverUrl) {
    return (
      <div aria-label={`${albumTitle} album cover unavailable`} className="aspect-square w-full bg-muted" role="img" />
    );
  }

  return (
    <img
      alt={`${albumTitle} album cover`}
      className="aspect-square w-full object-cover"
      height={640}
      referrerPolicy="no-referrer"
      src={coverUrl}
      width={640}
    />
  );
}
