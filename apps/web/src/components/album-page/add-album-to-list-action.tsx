import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ListPlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { AlbumListPickerDialog } from "@/components/list/album-list-picker-dialog";
import { ListDetailsDialog } from "@/components/list/list-details-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { listQueryKeys } from "@/lib/tanstack-query/query-keys";
import { addListItem, createList, getMyListsForAlbum } from "@/server/functions/list-functions";
import { tryCatch } from "@/try-catch";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { ListDetailsInput, MyListForAlbum, MyListsForAlbumPage } from "@/server/services/list-service";

const maxListItems = 100;

interface AddAlbumToListActionProps {
  albumId: string;
  albumTitle: string;
}

export function AddAlbumToListAction({ albumId, albumTitle }: AddAlbumToListActionProps) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [failedListIds, setFailedListIds] = useState<Set<string>>(() => new Set());
  const [pendingListIds, setPendingListIds] = useState<Set<string>>(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const pendingListIdsRef = useRef(new Set<string>());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = authClient.useSession();

  const viewerUserId = session.data?.user.id;
  const pickerQueryKey = listQueryKeys.forAlbum(albumId, viewerUserId ?? "");

  const getMyListsForAlbumFn = useServerFn(getMyListsForAlbum);
  const listsQuery = useInfiniteQuery({
    enabled: pickerOpen && Boolean(viewerUserId),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }: { pageParam: null | string }) =>
      getMyListsForAlbumFn({ data: { albumId, cursor: pageParam ?? undefined } }),
    queryKey: pickerQueryKey,
  });

  const addListItemFn = useServerFn(addListItem);
  const addListItemMutation = useMutation({ mutationFn: addListItemFn });

  const createListFn = useServerFn(createList);
  const createListMutation = useMutation({ mutationFn: createListFn });

  const pickerLists = listsQuery.data?.pages.flatMap((page) => page.lists) ?? [];

  function handleTriggerClick() {
    if (session.isPending) return;
    if (!viewerUserId) return setAuthDialogOpen(true);

    setPickerOpen(true);
  }

  async function handleListSelect(list: MyListForAlbum) {
    if (
      !viewerUserId ||
      list.containsAlbum ||
      list.itemCount >= maxListItems ||
      pendingListIdsRef.current.has(list.id)
    ) {
      return;
    }

    pendingListIdsRef.current.add(list.id);
    setPendingListIds(new Set(pendingListIdsRef.current));
    setFailedListIds((currentIds) => withoutListId(currentIds, list.id));

    const { data, error } = await tryCatch(addListItemMutation.mutateAsync({ data: { albumId, listId: list.id } }));

    pendingListIdsRef.current.delete(list.id);
    setPendingListIds(new Set(pendingListIdsRef.current));

    if (error) {
      setFailedListIds((currentIds) => withListId(currentIds, list.id));
      return toast.error(`Couldn't add ${albumTitle}`, { description: getErrorMessage(error) });
    }

    queryClient.setQueryData<InfiniteData<MyListsForAlbumPage, null | string>>(pickerQueryKey, (currentData) =>
      updatePickerMembership(currentData, list.id, data.added)
    );
    await invalidateListQueries(queryClient, list.id, viewerUserId);
  }

  function handleCreateList() {
    setPickerOpen(false);
    setCreateDialogOpen(true);
  }

  async function handleCreateListSubmit(values: ListDetailsInput) {
    if (!viewerUserId) return;

    const { data: createdList, error: createError } = await tryCatch(createListMutation.mutateAsync({ data: values }));

    if (createError) {
      return toast.error("Couldn't create list", { description: getErrorMessage(createError) });
    }

    const { error } = await tryCatch(addListItemMutation.mutateAsync({ data: { albumId, listId: createdList.id } }));

    setCreateDialogOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: listQueryKeys.albums(), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: listQueryKeys.byUser(viewerUserId), refetchType: "none" }),
    ]);

    if (error) {
      toast.error("List created without the album", { description: getErrorMessage(error) });
    }

    await navigate({ params: { listId: createdList.id }, to: "/list/$listId" });
  }

  function handlePickerOpenChange(open: boolean) {
    setPickerOpen(open);
    if (!open) setFailedListIds(new Set());
  }

  async function handleLoadMore() {
    await listsQuery.fetchNextPage();
  }

  async function handleRetry() {
    await listsQuery.refetch();
  }

  return (
    <>
      <Button
        aria-label="Add album to a list"
        className="text-muted-foreground hover:border-primary/70 hover:bg-primary/10 hover:text-foreground"
        disabled={session.isPending}
        onClick={handleTriggerClick}
        shape="pill"
        size="icon-lg"
        title="Add to list"
        type="button"
        variant="outline"
      >
        <ListPlus />
      </Button>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      {viewerUserId ? (
        <>
          <AlbumListPickerDialog
            failedListIds={failedListIds}
            hasNextPage={Boolean(listsQuery.hasNextPage)}
            isFetchingNextPage={listsQuery.isFetchingNextPage}
            isLoading={listsQuery.isPending}
            lists={pickerLists}
            loadError={listsQuery.isError}
            onCreateList={handleCreateList}
            onLoadMore={handleLoadMore}
            onOpenChange={handlePickerOpenChange}
            onRetry={handleRetry}
            onSelect={handleListSelect}
            open={pickerOpen}
            pendingListIds={pendingListIds}
          />
          <ListDetailsDialog
            isSubmitting={createListMutation.isPending || addListItemMutation.isPending}
            onOpenChange={setCreateDialogOpen}
            onSubmit={handleCreateListSubmit}
            open={createDialogOpen}
            variant="create"
          />
        </>
      ) : null}
    </>
  );
}

function updatePickerMembership(
  currentData: InfiniteData<MyListsForAlbumPage, null | string> | undefined,
  listId: string,
  added: boolean
) {
  if (!currentData) return currentData;

  return {
    ...currentData,
    pages: currentData.pages.map((page) => ({
      ...page,
      lists: page.lists.map((list) =>
        list.id === listId
          ? {
              ...list,
              containsAlbum: true,
              itemCount: list.containsAlbum || !added ? list.itemCount : list.itemCount + 1,
            }
          : list
      ),
    })),
  };
}

async function invalidateListQueries(queryClient: QueryClient, listId: string, viewerUserId: string) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: listQueryKeys.detail(listId),
      refetchType: "none",
    }),
    queryClient.invalidateQueries({
      queryKey: listQueryKeys.byUser(viewerUserId),
      refetchType: "none",
    }),
  ]);
}

function withListId(listIds: Set<string>, listId: string) {
  const nextIds = new Set(listIds);
  nextIds.add(listId);
  return nextIds;
}

function withoutListId(listIds: Set<string>, listId: string) {
  const nextIds = new Set(listIds);
  nextIds.delete(listId);
  return nextIds;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
