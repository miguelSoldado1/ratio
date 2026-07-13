import { ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileTabsSkeleton() {
  return (
    <div aria-label="Loading profile sections" className="mt-7 flex flex-col gap-4" role="status">
      <div className="-mx-5 flex h-12 w-[calc(100%+2.5rem)] items-end lg:-mx-10 lg:w-[calc(100%+5rem)]">
        <Skeleton className="h-0.5 w-full rounded-full" />
      </div>
      <ProfileReviewsSectionSkeleton />
    </div>
  );
}
