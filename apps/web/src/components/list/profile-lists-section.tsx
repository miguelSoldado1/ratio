import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListAddRow } from "./list-add-row";
import { ListCard } from "./list-card";
import type { RefObject } from "react";
import type { ListSummary } from "@/server/services/list-service";

interface ProfileListsSectionProps {
  canCreate: boolean;
  lists: ListSummary[];
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  onCreateList: () => void;
  profileDisplayName: string;
  showLoadMore?: boolean;
}

export function ProfileListsSection({
  canCreate,
  lists,
  loadMoreRef,
  onCreateList,
  profileDisplayName,
  showLoadMore,
}: ProfileListsSectionProps) {
  if (lists.length === 0) {
    return (
      <section aria-label={`${profileDisplayName}'s lists`} className="bg-background pt-7">
        <EmptyState
          description={
            canCreate
              ? "Lists are the fastest way to put your taste on the record. Start with something you already believe."
              : `${profileDisplayName} hasn't published any lists yet.`
          }
          title="No lists yet"
        >
          {canCreate ? (
            <Button onClick={onCreateList} type="button">
              <Plus data-icon="inline-start" />
              New list
            </Button>
          ) : null}
        </EmptyState>
      </section>
    );
  }

  return (
    <section aria-label={`${profileDisplayName}'s lists`} className="bg-background pt-7">
      <ul>
        {canCreate ? (
          <ListAddRow
            description="Collect albums around an idea and share the page"
            label="New list"
            onClick={onCreateList}
          />
        ) : null}
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </ul>
      {showLoadMore ? <div className="h-12" ref={loadMoreRef} /> : null}
    </section>
  );
}

export function ProfileListsSectionSkeleton() {
  return (
    <section aria-label="Loading profile lists" className="pt-7" role="status">
      <div>
        {Array.from({ length: 3 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders
          <div className="border-border border-b py-4 last:border-b-0" key={index}>
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-9" />
            </div>
            <div className="flex items-start gap-3">
              <Skeleton className="size-14 shrink-0 rounded-none" />
              <div className="min-w-0 flex-1 pt-0.5">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="mt-2 h-3 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
