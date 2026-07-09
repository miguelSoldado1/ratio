import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlbumArtwork } from "@/components/album-artwork";
import { AlbumHeader } from "@/components/album-page/album-header";
import { AlbumLookupLoading } from "@/components/album-page/album-lookup-loading";
import { RatingsPanel } from "@/components/album-page/ratings-panel";
import { ReviewsSection } from "@/components/album-page/reviews-section";
import { TrackList } from "@/components/album-page/track-list";
import { InlineError } from "@/components/inline-error";
import { PageContainer } from "@/components/page-container";
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
        <PageContainer className="py-12">
          <InlineError
            description="Could not load this album. It may be unavailable on Spotify or temporarily unreachable."
            title="Album unavailable"
          />
        </PageContainer>
      </main>
    );
  }

  const { album, tracks } = albumDetailsQuery.data;

  return (
    <main className="min-h-screen bg-background text-foreground" data-album-id={album.id}>
      <PageContainer className="grid gap-8 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] xl:gap-12">
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <AlbumCover albumTitle={album.title} coverUrl={album.coverUrl} />
          <TrackList className="mt-6" tracks={tracks} />
        </aside>
        <section className="min-w-0 lg:pt-10">
          <AlbumHeader album={album} coverUrl={album.coverUrl} />
          <RatingsPanel albumId={album.id} className="mt-6 lg:mt-8" />
          <TrackList className="mt-8 lg:hidden" collapsible tracks={tracks} />
          <div className="scroll-mt-16" id="album-reviews">
            <ReviewsSection album={album} className="mt-8 lg:mt-12" />
          </div>
        </section>
      </PageContainer>
    </main>
  );
}

interface AlbumCoverProps {
  albumTitle: string;
  coverUrl: string | null;
}

function AlbumCover({ albumTitle, coverUrl }: AlbumCoverProps) {
  return (
    <AlbumArtwork
      alt={`${albumTitle} album cover`}
      className="aspect-square w-full object-cover"
      height={640}
      src={coverUrl}
      width={640}
    />
  );
}
