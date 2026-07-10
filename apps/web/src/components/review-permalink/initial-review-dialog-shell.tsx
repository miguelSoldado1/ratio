import { ReviewDialogSkeleton } from "@/components/review-permalink/review-dialog-skeleton";
import { dialogContentClassName, dialogOverlayClassName } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function InitialReviewDialogShell() {
  return (
    <>
      <div aria-hidden="true" className={dialogOverlayClassName} />
      <div
        aria-hidden="true"
        className={cn(
          dialogContentClassName,
          "flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        )}
      >
        <div className="overflow-y-auto px-5 pt-5 pr-12 pb-5 sm:px-6 sm:pt-6 sm:pr-14 sm:pb-6">
          <ReviewDialogSkeleton />
        </div>
      </div>
    </>
  );
}
