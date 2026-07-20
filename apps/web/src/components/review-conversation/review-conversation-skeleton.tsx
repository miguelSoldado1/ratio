import { Skeleton } from "@/components/ui/skeleton";
import { ReplyRowsSkeleton } from "./reply-rows-skeleton";

/** Loading shape for the profile-style root review and its discussion. */
export function ReviewConversationSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading review" className="flex flex-col" role="status">
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex items-center gap-2 pt-6">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-28 rounded-sm" />
          <Skeleton className="h-3 w-8 rounded-sm" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-14 rounded-none" />
            <div>
              <Skeleton className="h-4 w-40 rounded-sm" />
              <Skeleton className="mt-2 h-3 w-28 rounded-sm" />
            </div>
          </div>
          <Skeleton className="h-4 w-20 rounded-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full rounded-sm" />
          <Skeleton className="h-4 w-full rounded-sm" />
          <Skeleton className="h-4 w-11/12 rounded-sm" />
          <Skeleton className="h-4 w-2/3 rounded-sm" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
        <div className="border-border/80 border-t pt-7">
          <Skeleton className="h-5 w-28 rounded-sm" />
          <div className="mt-4 border-border/80 border-y py-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-8 w-full rounded-md" />
                <Skeleton className="mt-2 ml-auto h-8 w-16 rounded-full" />
              </div>
            </div>
          </div>
          <ReplyRowsSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}
