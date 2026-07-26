import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ListCard } from "./list-card";
import type { ListSummary } from "./types";

interface ProfileListsSectionProps {
  canCreate: boolean;
  lists: ListSummary[];
  onCreateList: () => void;
  profileDisplayName: string;
}

export function ProfileListsSection({ canCreate, lists, onCreateList, profileDisplayName }: ProfileListsSectionProps) {
  if (lists.length === 0) {
    return (
      <div className="pt-2">
        <EmptyState
          align="center"
          description={
            canCreate
              ? "Lists are the fastest way to put your taste on the record. Start with something you already believe."
              : `${profileDisplayName} hasn't published any lists yet.`
          }
          title={canCreate ? "No lists yet" : "No lists"}
        />
        {canCreate ? (
          <div className="flex justify-center pb-4">
            <Button onClick={onCreateList} type="button">
              <Plus data-icon="inline-start" />
              New list
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-label={`${profileDisplayName}'s lists`}>
      {canCreate ? (
        <div className="flex justify-end pt-4 pb-1">
          <Button onClick={onCreateList} size="sm" type="button" variant="outline">
            <Plus data-icon="inline-start" />
            New list
          </Button>
        </div>
      ) : null}
      <ul className="border-border border-t">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </ul>
    </section>
  );
}
