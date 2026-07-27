import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { InlineError } from "@/components/inline-error";
import { AlbumPickerDialog } from "@/components/list/album-picker-dialog";
import { createListAlbumAddQueue } from "@/components/list/list-album-add-queue";
import { getFirstAddedCoverAlbums } from "@/components/list/list-cover-mosaic";
import { ListDetailsDialog } from "@/components/list/list-details-dialog";
import { ListPage, ListPageSkeleton } from "@/components/list/list-page";
import { NotFoundPage } from "@/components/not-found-page";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { authClient } from "@/lib/auth/auth-client";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";
import { listQueryKeys } from "@/lib/tanstack-query/query-keys";
import { addListItem, deleteList, getList, removeListItem, updateList } from "@/server/functions/list-functions";
import { tryCatch } from "@/try-catch";
import type { AlbumResult } from "@/components/global-search/types";
import type { ListDetails, ListDetailsInput } from "@/server/services/list-service";

const maxListItems = 100;

export const Route = createFileRoute("/list/$listId")({
  component: ListRoute,
  notFoundComponent: NotFoundPage,
  head: ({ params }) => {
    const path = `/list/${params.listId}`;

    return {
      links: [createCanonicalLink(path)],
      meta: createSeoMeta({
        description: "An album list on Ratio.",
        path,
        title: `Album List | ${siteName}`,
        type: "article",
      }),
    };
  },
});

function ListRoute() {
  const { listId } = Route.useParams();
  const session = authClient.useSession();
  const viewerUserId = session.data?.user.id;
  // Remount owner-only state when the list or resolved viewer identity changes.
  const routeIdentity = `${listId}:${session.isPending ? "pending" : (viewerUserId ?? "anonymous")}`;

  return (
    <ListRouteContent
      key={routeIdentity}
      listId={listId}
      sessionPending={session.isPending}
      viewerUserId={viewerUserId}
    />
  );
}

interface ListRouteContentProps {
  listId: string;
  sessionPending: boolean;
  viewerUserId?: string;
}

function ListRouteContent({ listId, sessionPending, viewerUserId }: ListRouteContentProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [editing, setEditing] = useState(false);
  const [removingAlbumIds, setRemovingAlbumIds] = useState<Set<string>>(() => new Set());

  const [failedAlbumIds, setFailedAlbumIds] = useState<Set<string>>(() => new Set());
  const [pendingAlbumIds, setPendingAlbumIds] = useState<Set<string>>(() => new Set());
  const addQueueRef = useRef(createListAlbumAddQueue());
  const pendingAlbumIdsRef = useRef(new Set<string>());

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const listQueryKey = listQueryKeys.detail(listId, viewerUserId);

  const getListFn = useServerFn(getList);
  const listQuery = useQuery({
    enabled: !sessionPending,
    queryFn: () => getListFn({ data: { listId } }),
    queryKey: listQueryKey,
  });

  const updateListFn = useServerFn(updateList);
  const updateListMutation = useMutation({ mutationFn: updateListFn });

  const deleteListFn = useServerFn(deleteList);
  const deleteListMutation = useMutation({ mutationFn: deleteListFn });

  const addListItemFn = useServerFn(addListItem);
  const addListItemMutation = useMutation({ mutationFn: addListItemFn });

  const removeListItemFn = useServerFn(removeListItem);
  const removeListItemMutation = useMutation({ mutationFn: removeListItemFn });

  const list = listQuery.data;

  function invalidateListMetadata(authorId: string) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: listQueryKeys.byUser(authorId), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: listQueryKeys.albums(), refetchType: "none" }),
    ]);
  }

  function invalidateListMembership(authorId: string, albumId: string) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: listQueryKeys.byUser(authorId), refetchType: "none" }),
      queryClient.invalidateQueries({ queryKey: listQueryKeys.album(albumId), refetchType: "none" }),
    ]);
  }

  async function handleDetailsSubmit(values: ListDetailsInput) {
    if (!list) return;

    const { data, error } = await tryCatch(updateListMutation.mutateAsync({ data: { ...values, listId } }));

    if (error) {
      return toast.error("Couldn't update list", { description: getErrorMessage(error) });
    }

    queryClient.setQueryData<ListDetails | null>(listQueryKey, (currentList) =>
      currentList
        ? {
            ...currentList,
            description: data.description ?? undefined,
            title: data.title,
            updatedAt: data.updatedAt,
          }
        : currentList
    );

    setDetailsOpen(false);
    await invalidateListMetadata(list.author.id);
  }

  async function handleDelete() {
    if (!list) return;

    const { error } = await tryCatch(deleteListMutation.mutateAsync({ data: { listId } }));

    if (error) {
      return toast.error("Couldn't delete list", { description: getErrorMessage(error) });
    }

    await invalidateListMetadata(list.author.id);

    await navigate({ params: { username: list.author.username }, to: "/user/$username" });
    queryClient.removeQueries({ queryKey: listQueryKeys.detail(listId) });
  }

  async function handleAlbumSelect(album: AlbumResult) {
    if (!list) return false;

    const currentList = queryClient.getQueryData<ListDetails | null>(listQueryKey);
    const alreadyAdded = currentList?.albums.some((currentAlbum) => currentAlbum.id === album.id);
    const pendingCount = pendingAlbumIdsRef.current.size;

    if (alreadyAdded || pendingAlbumIdsRef.current.has(album.id)) return false;
    if ((currentList?.albums.length ?? 0) + pendingCount >= maxListItems) return false;

    pendingAlbumIdsRef.current.add(album.id);
    setPendingAlbumIds(new Set(pendingAlbumIdsRef.current));
    setFailedAlbumIds((currentIds) => withoutAlbumId(currentIds, album.id));

    const added = await addQueueRef.current.enqueue(async () => {
      const { data: addedItem, error } = await tryCatch(
        addListItemMutation.mutateAsync({ data: { albumId: album.id, listId } })
      );
      pendingAlbumIdsRef.current.delete(album.id);
      setPendingAlbumIds(new Set(pendingAlbumIdsRef.current));

      if (error) {
        setFailedAlbumIds((currentIds) => withAlbumId(currentIds, album.id));
        toast.error(`Couldn't add ${album.name}`, { description: getErrorMessage(error) });
        return false;
      }

      if (!addedItem.added) {
        await queryClient.invalidateQueries({ queryKey: listQueryKey });
        await invalidateListMembership(list.author.id, album.id);
        return false;
      }

      queryClient.setQueryData<ListDetails | null>(listQueryKey, (current) => {
        if (!current) return current;

        const albums = [addedItem.album, ...current.albums];

        return {
          ...current,
          albums,
          coverAlbums: getFirstAddedCoverAlbums(albums),
          updatedAt: addedItem.updatedAt,
        };
      });

      await invalidateListMembership(list.author.id, album.id);

      return addedItem.added;
    });

    return added;
  }

  async function handleRemoveAlbum(albumId: string) {
    if (!list || removingAlbumIds.has(albumId)) return;

    setRemovingAlbumIds((currentIds) => withAlbumId(currentIds, albumId));
    const { data, error } = await tryCatch(removeListItemMutation.mutateAsync({ data: { albumId, listId } }));

    setRemovingAlbumIds((currentIds) => withoutAlbumId(currentIds, albumId));

    if (error) {
      return toast.error("Couldn't remove album", { description: getErrorMessage(error) });
    }

    if (!data.removed) return;

    const currentList = queryClient.getQueryData<ListDetails | null>(listQueryKey);
    if ((currentList?.albums.length ?? 0) <= 1) setEditing(false);

    queryClient.setQueryData<ListDetails | null>(listQueryKey, (current) => {
      if (!current) return current;

      const albums = current.albums.filter((album) => album.id !== data.albumId);

      return {
        ...current,
        albums,
        coverAlbums: getFirstAddedCoverAlbums(albums),
        updatedAt: data.updatedAt,
      };
    });
    await invalidateListMembership(list.author.id, data.albumId);
  }

  function handlePickerOpenChange(open: boolean) {
    setPickerOpen(open);
    if (!open) setFailedAlbumIds(new Set());
  }

  if (sessionPending || listQuery.isPending) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer>
          <ListPageSkeleton />
        </PageContainer>
      </main>
    );
  }

  if (listQuery.isError) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer>
          <PageContainerContent className="py-12">
            <InlineError description="Could not load this list right now." title="List unavailable" />
          </PageContainerContent>
        </PageContainer>
      </main>
    );
  }

  if (!list) return <NotFoundPage />;

  const addedAlbumIds = new Set(list.albums.map((album) => album.id));
  const remainingSlots = Math.max(0, maxListItems - list.albums.length - pendingAlbumIds.size);

  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer>
          <ListPage
            canAddAlbum={remainingSlots > 0}
            editing={editing}
            isDeleting={deleteListMutation.isPending}
            list={list}
            onAddAlbum={() => setPickerOpen(true)}
            onDelete={handleDelete}
            onEditDetails={() => setDetailsOpen(true)}
            onEditingChange={setEditing}
            onRemoveAlbum={handleRemoveAlbum}
            removingAlbumIds={removingAlbumIds}
          />
        </PageContainer>
      </main>
      {list.canEdit ? (
        <>
          <AlbumPickerDialog
            addedAlbumIds={addedAlbumIds}
            failedAlbumIds={failedAlbumIds}
            onOpenChange={handlePickerOpenChange}
            onSelect={handleAlbumSelect}
            open={pickerOpen}
            pendingAlbumIds={pendingAlbumIds}
            remainingSlots={remainingSlots}
          />
          <ListDetailsDialog
            initialValues={{ description: list.description ?? "", title: list.title }}
            isSubmitting={updateListMutation.isPending}
            onOpenChange={setDetailsOpen}
            onSubmit={handleDetailsSubmit}
            open={detailsOpen}
            variant="edit"
          />
        </>
      ) : null}
    </>
  );
}

function withAlbumId(albumIds: Set<string>, albumId: string) {
  const nextIds = new Set(albumIds);
  nextIds.add(albumId);
  return nextIds;
}

function withoutAlbumId(albumIds: Set<string>, albumId: string) {
  const nextIds = new Set(albumIds);
  nextIds.delete(albumId);
  return nextIds;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
