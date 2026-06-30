import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
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
import { albumQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getAlbumDetails } from "@/server/functions/spotify-functions";

interface AlbumPageProps {
  albumId: string;
}

export function AlbumPage({ albumId }: AlbumPageProps) {
  const navigate = useNavigate();
  const getAlbumDetailsFn = useServerFn(getAlbumDetails);
  const albumDetailsQuery = useQuery({
    queryFn: () => getAlbumDetailsFn({ data: { albumId } }),
    queryKey: albumQueryKeys.details(albumId),
  });

  useEffect(() => {
    if (albumDetailsQuery.isError) {
      navigate({ to: "/" });
    }
  }, [albumDetailsQuery.isError, navigate]);

  if (albumDetailsQuery.isPending) return <AlbumLookupLoading albumId={albumId} />;
  if (albumDetailsQuery.isError) return null;

  const { album, tracks } = albumDetailsQuery.data;
  const artist = getAlbumArtistNames(album);
  const releaseYear = getAlbumReleaseYear(album);
  const albumRuntime = getAlbumRuntimeLabel(album);

  return (
    <main className="min-h-screen bg-background text-foreground" data-album-id={albumId}>
      <div className="mx-auto grid w-full max-w-375 gap-8 px-5 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] lg:px-10 xl:gap-12 xl:px-14 2xl:px-20">
        <MobileAlbumHeader album={album} albumId={albumId} coverUrl={album.coverUrl} />
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <AlbumCover albumTitle={album.title} coverUrl={album.coverUrl} />
          <TrackList className="mt-6" tracks={tracks} />
        </aside>
        <section className="min-w-0 pt-3 lg:pt-10">
          <div className="hidden lg:block">
            <h1 className="max-w-4xl font-semibold text-4xl leading-tight tracking-normal md:text-5xl">
              {album.title}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {artist} · {releaseYear}
            </p>
            <p className="mt-1 text-muted-foreground/70 text-sm">{albumRuntime}</p>

            <AlbumActions
              albumArtist={artist}
              albumId={albumId}
              albumTitle={album.title}
              className="mt-6"
              spotifyUrl={album.spotifyUrl}
            />
          </div>
          <RatingsPanel albumId={albumId} className="mt-2 lg:mt-8" />
          <ReviewsSection albumId={albumId} className="mt-10 lg:mt-12" />
        </section>
      </div>
    </main>
  );
}

function AlbumCover({ albumTitle, coverUrl }: { albumTitle: string; coverUrl: string | null }) {
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
