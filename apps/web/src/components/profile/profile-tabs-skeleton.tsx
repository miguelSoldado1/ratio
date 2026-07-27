import { ProfileReviewsSectionSkeleton } from "@/components/profile/profile-reviews-section";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileTabsSkeleton() {
  return (
    <div aria-label="Loading profile sections" className="-mt-px flex flex-col" role="status">
      <div className="-mx-5 w-[calc(100%+2.5rem)] border-border/70 border-b lg:-mx-10 lg:w-[calc(100%+5rem)]">
        <div className="flex h-12 items-end">
          <Skeleton className="h-0.5 w-full rounded-full" />
        </div>
      </div>
      <ProfileReviewsSectionSkeleton className="pt-7" />
    </div>
  );
}
