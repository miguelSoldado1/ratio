import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const ReviewCardSkeleton = {
  Album: SkeletonAlbum,
  Footer: SkeletonFooter,
  Header: SkeletonHeader,
  Rating: SkeletonRating,
  Review: SkeletonReview,
  Root: SkeletonRoot,
};

interface SkeletonRootProps {
  children: ReactNode;
  className?: string;
}

function SkeletonRoot({ children, className }: SkeletonRootProps) {
  return (
    <article className={cn("border-border/80 border-b py-5 last-of-type:border-0", className)}>{children}</article>
  );
}

function SkeletonHeader({ className }: { className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center gap-2", className)}>
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-9" />
    </div>
  );
}

function SkeletonAlbum({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-start gap-3", className)}>
      <Skeleton className="size-14 shrink-0 rounded-none" />
      <div className="min-w-0 flex-1 pt-0.5">
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="mt-2 h-3 w-36 max-w-3/4" />
      </div>
    </div>
  );
}

function SkeletonRating({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-24 shrink-0", className)} />;
}

function SkeletonReview({ className }: { className?: string }) {
  return (
    <div className={cn("mt-3 flex flex-col gap-2", className)}>
      <Skeleton className="h-4.5 w-full max-w-2xl" />
      <Skeleton className="h-4.5 w-5/6 max-w-xl" />
    </div>
  );
}

function SkeletonFooter({ className }: { className?: string }) {
  return <Skeleton className={cn("mt-4 h-4 w-12", className)} />;
}
