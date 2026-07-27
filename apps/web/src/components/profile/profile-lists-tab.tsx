import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { InlineError } from "@/components/inline-error";
import { ListDetailsDialog } from "@/components/list/list-details-dialog";
import { ProfileListsSection, ProfileListsSectionSkeleton } from "@/components/list/profile-lists-section";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { listQueryKeys } from "@/lib/tanstack-query/query-keys";
import { createList, getUserLists } from "@/server/functions/list-functions";
import { tryCatch } from "@/try-catch";
import type { InfiniteData } from "@tanstack/react-query";
import type { ListDetailsInput, ListSummary } from "@/server/services/list-service";
import type { UserProfile } from "@/server/services/review-service";

interface ProfileListsTabProps {
  active: boolean;
  profileUser: UserProfile["user"];
  viewerUserId?: string;
}

interface UserListsPage {
  lists: ListSummary[];
  nextCursor: null | string;
}

export function ProfileListsTab({ active, profileUser, viewerUserId }: ProfileListsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const listsQueryKey = listQueryKeys.byUser(profileUser.id, viewerUserId);

  const getUserListsFn = useServerFn(getUserLists);
  const userListsQuery = useInfiniteQuery({
    enabled: active,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getUserListsFn({ data: { cursor: pageParam ?? undefined, userId: profileUser.id } }),
    queryKey: listsQueryKey,
  });

  const createListFn = useServerFn(createList);
  const createListMutation = useMutation({ mutationFn: createListFn });

  const lists = userListsQuery.data?.pages.flatMap((page) => page.lists) ?? [];
  const { fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage } = userListsQuery;
  const loadMoreRef = useLoadMoreOnIntersect({
    enabled: active && hasNextPage && !isFetchNextPageError,
    isLoading: isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  async function handleCreateList(values: ListDetailsInput) {
    if (!profileUser.canEdit) return;

    const { data: createdList, error } = await tryCatch(createListMutation.mutateAsync({ data: values }));

    if (error) {
      return toast.error("Couldn't create list", {
        description: error instanceof Error ? error.message : "Something went wrong. Try again.",
      });
    }

    const createdSummary: ListSummary = {
      author: {
        avatarUrl: profileUser.avatarUrl,
        displayName: profileUser.displayName,
        id: profileUser.id,
        username: profileUser.username,
      },
      coverAlbums: [],
      description: values.description ?? undefined,
      id: createdList.id,
      itemCount: 0,
      title: values.title,
      updatedAt: createdList.updatedAt,
    };

    queryClient.setQueryData<InfiniteData<UserListsPage, string | null>>(listsQueryKey, (currentData) => {
      if (!currentData) {
        return {
          pageParams: [null],
          pages: [{ lists: [createdSummary], nextCursor: null }],
        };
      }

      const [firstPage, ...remainingPages] = currentData.pages;
      if (!firstPage) return currentData;

      return {
        ...currentData,
        pages: [{ ...firstPage, lists: [createdSummary, ...firstPage.lists] }, ...remainingPages],
      };
    });

    await queryClient.invalidateQueries({ queryKey: listQueryKeys.albums(), refetchType: "none" });
    setDetailsOpen(false);
    await navigate({ params: { listId: createdList.id }, to: "/list/$listId" });
  }

  if (userListsQuery.isPending) {
    return <ProfileListsSectionSkeleton />;
  }

  if (userListsQuery.isError && lists.length === 0) {
    return (
      <InlineError
        className="bg-background pt-7"
        description="Could not load lists for this profile."
        title="Lists unavailable"
      />
    );
  }

  return (
    <>
      <ProfileListsSection
        canCreate={profileUser.canEdit}
        lists={lists}
        loadMoreRef={loadMoreRef}
        onCreateList={() => setDetailsOpen(true)}
        profileDisplayName={profileUser.displayName}
        showLoadMore={Boolean(hasNextPage) || isFetchingNextPage}
      />
      {profileUser.canEdit ? (
        <ListDetailsDialog
          isSubmitting={createListMutation.isPending}
          onOpenChange={setDetailsOpen}
          onSubmit={handleCreateList}
          open={detailsOpen}
          variant="create"
        />
      ) : null}
    </>
  );
}
