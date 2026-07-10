import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RatingsPanelSkeleton } from "./ratings-panel";
import { ReviewsSectionSkeleton } from "./reviews-section-skeleton";

const TRACK_ROW_SKELETONS = [
  "track-row-1",
  "track-row-2",
  "track-row-3",
  "track-row-4",
  "track-row-5",
  "track-row-6",
  "track-row-7",
  "track-row-8",
  "track-row-9",
  "track-row-10",
  "track-row-11",
  "track-row-12",
];

export function AlbumLookupLoading({ albumId }: { albumId: string }) {
  return (
    <main aria-busy="true" className="min-h-screen bg-background text-foreground" data-album-id={albumId}>
      <div className="mx-auto grid w-full max-w-375 gap-8 px-5 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] lg:px-10 xl:gap-12 xl:px-14 2xl:px-20">
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <Skeleton className="aspect-square w-full rounded-none" />
          <TrackListSkeleton className="mt-6" />
        </aside>

        <section className="min-w-0 lg:pt-10">
          <AlbumHeaderSkeleton />
          <RatingsPanelSkeleton className="mt-6 lg:mt-8" />
          <ReviewsSectionSkeleton className="mt-10 lg:mt-12" />
        </section>
      </div>
    </main>
  );
}

function AlbumHeaderSkeleton() {
  return (
    <section>
      <div className="grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[144px_1fr] lg:block">
        <div className="lg:hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
        </div>
        <div className="min-w-0 self-end lg:self-auto">
          <Skeleton className="h-7.5 w-full max-w-70 sm:h-9.5 lg:h-11 lg:max-w-4xl xl:h-14" />
          <Skeleton className="mt-2 h-5 w-4/5 max-w-56 lg:h-7 lg:max-w-80" />
          <Skeleton className="mt-1 h-4 w-2/3 max-w-44 lg:h-5 lg:max-w-52" />
        </div>
      </div>
      <ActionSkeletons className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2 lg:mt-6 lg:flex lg:flex-wrap lg:items-center lg:gap-3" />
    </section>
  );
}

function ActionSkeletons({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-10 min-w-0 rounded-4xl lg:w-36" />
      <Skeleton className="size-10 rounded-4xl" />
      <Skeleton className="size-10 rounded-4xl" />
    </div>
  );
}

function TrackListSkeleton({ className }: { className?: string }) {
  return (
    <section className={cn("pt-5", className)}>
      <Skeleton className="h-4 w-16" />
      <div className="mt-3 divide-y divide-border/70">
        {TRACK_ROW_SKELETONS.map((rowId) => (
          <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3" key={rowId}>
            <Skeleton className="h-4 w-3" />
            <Skeleton className="h-5 w-full max-w-80" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </section>
  );
}
