import { ReviewDialogSkeleton } from "@/components/review-permalink/review-dialog-skeleton";

export function InitialReviewDialogShell() {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 isolate z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm"
      />
      <div
        aria-hidden="true"
        className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-4xl bg-popover p-0 text-popover-foreground text-sm shadow-xl outline-none ring-1 ring-foreground/5 sm:max-w-2xl dark:ring-foreground/10"
      >
        <div className="overflow-y-auto px-5 pt-5 pr-12 pb-5 sm:px-6 sm:pt-6 sm:pr-14 sm:pb-6">
          <ReviewDialogSkeleton />
        </div>
      </div>
    </>
  );
}
