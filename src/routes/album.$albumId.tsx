import { createFileRoute } from "@tanstack/react-router";
import { Heart, PencilLine, Plus } from "lucide-react";
import { ReviewCard } from "@/components/review-card";
import { Button } from "@/components/ui/button";
import { type AlbumPageData, albumPageData, albumPageNoRatingsData } from "@/lib/album-page-mock";
import { abbreviateCount, cn } from "@/lib/utils";

export const Route = createFileRoute("/album/$albumId")({ component: AlbumPage });

function RatingDistributionChart({ ratingDistribution }: { ratingDistribution: AlbumPageData["ratingDistribution"] }) {
  const maxCount = Math.max(1, ...ratingDistribution.map((item) => item.count));

  return (
    <div aria-label="Ratings distribution from 1 to 5" role="img">
      <div className="grid h-32 grid-cols-5 items-end gap-3 border-border border-b pb-2 sm:h-40 sm:gap-5">
        {ratingDistribution.map((item) => (
          <div className="flex h-full min-w-0 items-end" key={item.rating}>
            <div
              className="w-full origin-bottom rounded-t-sm bg-primary transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:scale-y-[1.03] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/80"
              style={{ height: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
              title={`${abbreviateCount(item.count)} ratings at ${item.rating}`}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3 pt-2 sm:gap-5">
        {ratingDistribution.map((item) => (
          <div className="min-w-0 text-center" key={item.rating}>
            <p className="font-medium text-xs tabular-nums">{item.rating}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/70 tabular-nums">{abbreviateCount(item.count)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyRatingDistributionChart({
  ratingDistribution,
}: {
  ratingDistribution: AlbumPageData["ratingDistribution"];
}) {
  return (
    <div aria-label="No ratings distribution yet" role="img">
      <div className="grid h-32 grid-cols-5 items-end gap-3 border-border border-b pb-2 sm:h-40 sm:gap-5">
        {ratingDistribution.map((item) => (
          <div className="flex h-full min-w-0 items-end" key={item.rating}>
            <div className="h-1 w-full rounded-t-sm bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3 pt-2 sm:gap-5">
        {ratingDistribution.map((item) => (
          <div className="min-w-0 text-center" key={item.rating}>
            <p className="font-medium text-muted-foreground text-xs tabular-nums">{item.rating}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/70 tabular-nums">0</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlbumActions({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(compact ? "grid grid-cols-[1fr_auto_auto] gap-2" : "flex flex-wrap items-center gap-3", className)}
    >
      <Button className="bg-[#1DB954] px-5 text-[#06150b] hover:bg-[#41d873]" size="lg" type="button">
        <PencilLine className="size-4" />
        Add a review
      </Button>
      <Button
        aria-label="Save album"
        className="text-muted-foreground hover:border-[#B7B2A8]/60 hover:text-foreground"
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Plus className="size-5" />
      </Button>
      <Button
        aria-label="Like album"
        className="text-muted-foreground hover:border-[#FF6B4A]/70 hover:text-[#FF6B4A]"
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Heart className="size-5" />
      </Button>
    </div>
  );
}

function RatingsPanel({
  className,
  ratingDistribution,
  ratingSummary,
}: {
  className?: string;
  ratingDistribution: AlbumPageData["ratingDistribution"];
  ratingSummary: AlbumPageData["ratingSummary"];
}) {
  const hasRatings = ratingSummary !== null && ratingDistribution.some((item) => item.count > 0);

  return (
    <section aria-label="Album ratings" className={cn("border-border border-t py-5", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          {hasRatings ? (
            <ReviewCard.Rating className="[&_span]:text-base [&_svg]:size-5" value={ratingSummary.average} />
          ) : (
            <p className="font-medium text-base">No ratings yet</p>
          )}
        </div>
        <p className="text-muted-foreground text-sm tabular-nums">{hasRatings ? ratingSummary.total : "0 ratings"}</p>
      </div>
      {hasRatings ? (
        <RatingDistributionChart ratingDistribution={ratingDistribution} />
      ) : (
        <EmptyRatingDistributionChart ratingDistribution={ratingDistribution} />
      )}
    </section>
  );
}

function TrackList({ className, tracks }: { className?: string; tracks: AlbumPageData["tracks"] }) {
  return (
    <section className={cn("pt-5", className)}>
      <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-[0.24em]">Tracks</h2>
      <div className="mt-3 divide-y divide-border/70">
        {tracks.map((track, trackIndex) => (
          <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3" key={track.id}>
            <span className="text-muted-foreground text-xs tabular-nums">{trackIndex + 1}</span>
            <span className="min-w-0 truncate font-medium text-sm">{track.title}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{track.duration}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewsSection({ className, reviews }: { className?: string; reviews: AlbumPageData["reviews"] }) {
  if (reviews.length === 0) {
    return (
      <section className={cn("border-border/80 border-t py-8", className)}>
        <p className="font-medium text-sm">No reviews yet</p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          Reviews will appear here once people start rating this album.
        </p>
      </section>
    );
  }

  return (
    <section className={className}>
      {reviews.map((review) => (
        <ReviewCard.Root className="border-border/80" key={review.id}>
          <ReviewCard.Header createdAt={review.createdAt} href={`/user/${review.user.username}`} user={review.user} />
          <ReviewCard.Rating value={review.rating} />
          {review.review ? <ReviewCard.Review>{review.review}</ReviewCard.Review> : null}
          {review.likes === undefined ? null : (
            <ReviewCard.Footer>
              <ReviewCard.Likes count={review.likes} liked={review.liked} />
            </ReviewCard.Footer>
          )}
        </ReviewCard.Root>
      ))}
    </section>
  );
}

function MobileAlbumHeader({ album }: { album: AlbumPageData["album"] }) {
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

function AlbumPage() {
  const { albumId } = Route.useParams();
  const pageData = albumId === albumPageNoRatingsData.album.id ? albumPageNoRatingsData : albumPageData;
  const { album, ratingDistribution, ratingSummary, reviews, tracks } = pageData;
  const albumRuntime = `${album.totalTracks} tracks · ${album.runtime}`;

  return (
    <main className="min-h-screen bg-background text-foreground" data-album-id={albumId}>
      <div className="mx-auto grid w-full max-w-375 gap-8 px-5 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] lg:px-10 xl:gap-12 xl:px-14 2xl:px-20">
        <MobileAlbumHeader album={album} />

        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <img
            alt={`${album.title} album cover`}
            className="aspect-square w-full object-cover"
            height={640}
            referrerPolicy="no-referrer"
            src={album.coverUrl}
            width={640}
          />
          <TrackList className="mt-6" tracks={tracks} />
        </aside>

        <section className="min-w-0 pt-3 lg:pt-10">
          <div className="hidden lg:block">
            <h1 className="max-w-4xl font-semibold text-4xl leading-tight tracking-normal md:text-5xl">
              {album.title}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {album.artist} · {album.release}
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
