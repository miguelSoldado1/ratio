import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RATING_BAR_SKELETONS = [
  { height: 36, id: "rating-bar-1" },
  { height: 58, id: "rating-bar-2" },
  { height: 84, id: "rating-bar-3" },
  { height: 68, id: "rating-bar-4" },
  { height: 44, id: "rating-bar-5" },
] as const;
const RATING_LABEL_SKELETONS = [
  "rating-label-1",
  "rating-label-2",
  "rating-label-3",
  "rating-label-4",
  "rating-label-5",
];
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
        <MobileAlbumHeaderSkeleton />

        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <Skeleton className="aspect-square w-full rounded-none" />
          <TrackListSkeleton className="mt-6" />
        </aside>

        <section className="min-w-0 pt-3 lg:pt-10">
          <DesktopAlbumHeaderSkeleton />
          <RatingsPanelSkeleton className="mt-2 lg:mt-8" />
          <TrackListSkeleton className="mt-8 lg:hidden" />
          <ReviewsSkeleton className="mt-10 lg:mt-12" />
        </section>
      </div>
    </main>
  );
}

function MobileAlbumHeaderSkeleton() {
  return (
    <section className="lg:hidden">
      <div className="grid grid-cols-[112px_1fr] gap-4 sm:grid-cols-[144px_1fr]">
        <Skeleton className="aspect-square w-full rounded-none" />
        <div className="min-w-0 self-end">
          <Skeleton className="h-7.5 w-full max-w-70 sm:h-9.5" />
          <Skeleton className="mt-2 h-5 w-4/5 max-w-56" />
          <Skeleton className="mt-1 h-4 w-2/3 max-w-44" />
        </div>
      </div>
      <ActionSkeletons className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2" />
    </section>
  );
}

function DesktopAlbumHeaderSkeleton() {
  return (
    <div className="hidden lg:block">
      <Skeleton className="h-15 w-full max-w-4xl" />
      <Skeleton className="mt-2 h-7 w-80 max-w-full" />
      <Skeleton className="mt-1 h-5 w-52 max-w-full" />
      <ActionSkeletons className="mt-6 flex flex-wrap items-center gap-3" />
    </div>
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

function RatingsPanelSkeleton({ className }: { className?: string }) {
  return (
    <section aria-label="Loading album ratings" className={cn("border-border border-t py-5", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="grid h-32 grid-cols-5 items-end gap-3 border-border border-b pb-2 sm:h-40 sm:gap-5">
        {RATING_BAR_SKELETONS.map((bar) => (
          <div className="flex h-full min-w-0 items-end" key={bar.id}>
            <Skeleton className="w-full rounded-t-sm rounded-b-none" style={{ height: `${bar.height}%` }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3 pt-2 sm:gap-5">
        {RATING_LABEL_SKELETONS.map((labelId) => (
          <div className="flex min-w-0 flex-col items-center gap-2" key={labelId}>
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-2 w-7" />
          </div>
        ))}
      </div>
    </section>
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

function ReviewsSkeleton({ className }: { className?: string }) {
  return (
    <section className={cn("border-border/80 border-t py-8", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-5/6 max-w-xl" />
        <Skeleton className="h-4 w-2/3 max-w-lg" />
      </div>
    </section>
  );
}
