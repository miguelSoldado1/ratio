import { Skeleton } from "@/components/ui/skeleton";

export function ReviewDialogSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-28 rounded-sm" />
        <Skeleton className="h-3 w-8 rounded-sm" />
      </div>
      <div className="flex items-start gap-3">
        <Skeleton className="size-14 rounded-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-48 max-w-full rounded-sm" />
          <Skeleton className="h-3 w-32 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-20 rounded-sm" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full rounded-sm" />
        <Skeleton className="h-4 w-11/12 rounded-sm" />
        <Skeleton className="h-4 w-2/3 rounded-sm" />
      </div>
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  );
}
