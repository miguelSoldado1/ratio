import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

interface SearchResultSkeletonRowsProps {
  count?: number;
}

export function SearchResultSkeletonRows({ count = 5 }: SearchResultSkeletonRowsProps) {
  return (
    <div aria-label="Loading search results" className="px-2 py-1" role="status">
      <span className="sr-only">Loading search results</span>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <SearchResultSkeletonRow index={index} key={index} />
      ))}
    </div>
  );
}

interface SearchResultSkeletonRowProps {
  index: number;
}

function SearchResultSkeletonRow({ index }: SearchResultSkeletonRowProps) {
  const titleWidth = index % 3 === 1 ? "w-56" : "w-44";
  const metaWidth = index % 2 === 0 ? "w-32" : "w-24";

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2.5">
      <Skeleton className="size-10 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <Skeleton className={cn("h-4 max-w-full rounded-sm", titleWidth)} />
        <Skeleton className={cn("mt-2 h-3 max-w-full rounded-sm", metaWidth)} />
      </div>
    </div>
  );
}
