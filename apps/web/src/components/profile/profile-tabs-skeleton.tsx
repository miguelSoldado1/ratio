import { ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileTabsSkeleton() {
  return (
    <div aria-label="Loading profile sections" className="mt-7 flex flex-col gap-4" role="status">
      <div className="flex h-9 w-full items-end">
        <Skeleton className="h-0.5 w-full rounded-full" />
      </div>
      <ProfileReviewsSectionSkeleton />
    </div>
  );
}
