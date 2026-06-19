import { AlbumActions } from "./album-actions";
import { MobileAlbumHeader } from "./mobile-album-header";
import { RatingsPanel } from "./ratings-panel";
import { ReviewsSection } from "./reviews-section";
import { TrackList } from "./track-list";
import type { AlbumPageData } from "@/lib/album-page-mock";
import type { getAlbumDetails } from "@/server/functions/spotify-functions";

type SpotifyAlbumDetails = Awaited<ReturnType<typeof getAlbumDetails>>;

interface AlbumPageViewProps {
  albumDetails: SpotifyAlbumDetails;
  albumId: string;
  communityData: AlbumPageData;
}

export function AlbumPageView({ albumDetails, albumId, communityData }: AlbumPageViewProps) {
  const { album, tracks } = albumDetails;
  const title = album.title;
  const coverUrl = album.coverUrl ?? communityData.album.coverUrl;
  const artist = album.artists.map((albumArtist) => albumArtist.name).join(", ");
  const release = album.releaseDate.slice(0, 4);
  const runtime = formatAlbumRuntime(album.durationMs);
  const albumRuntime = `${album.totalTracks} tracks · ${runtime}`;
  const headerAlbum = { artist, coverUrl, release, runtime, title, totalTracks: album.totalTracks };
  const { ratingDistribution, ratingSummary, reviews } = communityData;

  return (
    <main className="min-h-screen bg-background text-foreground" data-album-id={albumId}>
      <div className="mx-auto grid w-full max-w-375 gap-8 px-5 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] lg:px-10 xl:gap-12 xl:px-14 2xl:px-20">
        <MobileAlbumHeader album={headerAlbum} />

        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <img
            alt={`${title} album cover`}
            className="aspect-square w-full object-cover"
            height={640}
            referrerPolicy="no-referrer"
            src={coverUrl}
            width={640}
          />
          <TrackList className="mt-6" tracks={tracks} />
        </aside>

        <section className="min-w-0 pt-3 lg:pt-10">
          <div className="hidden lg:block">
            <h1 className="max-w-4xl font-semibold text-4xl leading-tight tracking-normal md:text-5xl">{title}</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {artist} · {release}
            </p>
            <p className="mt-1 text-muted-foreground/70 text-sm">{albumRuntime}</p>

            <AlbumActions className="mt-6" />
          </div>

          <RatingsPanel
            className="mt-2 lg:mt-8"
            ratingDistribution={ratingDistribution}
            ratingSummary={ratingSummary}
          />

          <TrackList className="mt-8 lg:hidden" tracks={tracks} />

          <ReviewsSection className="mt-10 lg:mt-12" reviews={reviews} />
        </section>
      </div>
    </main>
  );
}

function formatAlbumRuntime(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }

  return `${minutes} min ${seconds} sec`;
}
