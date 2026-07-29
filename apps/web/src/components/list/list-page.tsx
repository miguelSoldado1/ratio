import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageContainerContent } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { tryCatch } from "@/try-catch";
import { ListCoverMosaic } from "./list-cover-mosaic";
import { ListHeader } from "./list-header";
import { ListItemRow } from "./list-item-row";
import { ListManagementMenu } from "./list-management-menu";
import { listRowClassName } from "./list-row-styles";
import type { AutoScrollOptions, DragEndEvent } from "@dnd-kit/core";
import type { ListDetails } from "@/server/services/list-service";

const screenReaderInstructions = {
  draggable:
    "To pick up an album, press Space or Enter. While sorting, use the arrow keys to move it. Press Space or Enter again to drop it, or Escape to cancel.",
};

const listAutoScroll: AutoScrollOptions = {
  acceleration: 4,
  interval: 12,
  threshold: {
    x: 0.08,
    y: 0.08,
  },
};

interface ListPageProps {
  canAddAlbum: boolean;
  editing: boolean;
  isDeleting?: boolean;
  isReordering: boolean;
  list: ListDetails;
  onAddAlbum: () => void;
  onDelete: () => void;
  onEditDetails: () => void;
  onEditingChange: (editing: boolean) => void;
  onRemoveAlbum: (albumId: string) => void;
  onReorderAlbums: (albumIds: string[]) => Promise<boolean>;
  removingAlbumIds?: Set<string>;
}

export function ListPage({
  canAddAlbum,
  editing,
  isDeleting = false,
  isReordering,
  list,
  onAddAlbum,
  onDelete,
  onEditDetails,
  onEditingChange,
  onRemoveAlbum,
  onReorderAlbums,
  removingAlbumIds = new Set(),
}: ListPageProps) {
  const [pendingAlbumIds, setPendingAlbumIds] = useState<string[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isEditing = editing && list.canEdit;
  const hasAlbums = list.albums.length > 0;
  const sortingDisabled = isReordering || removingAlbumIds.size > 0;
  const albumsById = new Map(list.albums.map((album) => [album.id, album]));
  const orderedAlbums = (pendingAlbumIds ?? list.albums.map((album) => album.id)).flatMap((albumId) => {
    const album = albumsById.get(albumId);
    return album ? [album] : [];
  });
  const displayedAlbums = orderedAlbums.length === list.albums.length ? orderedAlbums : list.albums;
  const albumIds = displayedAlbums.map((album) => album.id);

  function getAlbumTitle(id: string | number) {
    return displayedAlbums.find((album) => album.id === String(id))?.title ?? "album";
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = albumIds.indexOf(String(active.id));
    const overIndex = albumIds.indexOf(String(over.id));
    if (activeIndex < 0 || overIndex < 0) return;

    const nextAlbumIds = arrayMove(albumIds, activeIndex, overIndex);

    // dnd-kit clears the dragged row's transform in the same React batch as this handler. Keep the
    // rendered order locally so that batch already contains the final slot; the cache update then
    // becomes persistence rather than a second-frame visual update.
    setPendingAlbumIds(nextAlbumIds);
    await tryCatch(onReorderAlbums(nextAlbumIds));
    setPendingAlbumIds((currentAlbumIds) =>
      currentAlbumIds && haveSameOrder(currentAlbumIds, nextAlbumIds) ? null : currentAlbumIds
    );
  }

  return (
    // Unlike the album page, nothing here spans the content column — the rows stay at the
    // description's measure. Capping the page to cover + gap + rows turns the leftover into even
    // margins instead of a 300px hole against the right edge.
    <PageContainerContent className="grid max-w-285 gap-8 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] xl:gap-12">
      {/* Cover lives inline in the header below the two-column breakpoint, matching the album page. */}
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <ListCoverMosaic albums={list.coverAlbums} className="w-full" size={640} />
      </aside>
      <section className="min-w-0 lg:pt-10">
        <ListHeader
          canAddAlbum={canAddAlbum}
          editing={isEditing}
          list={list}
          managementMenu={
            list.canEdit ? (
              <ListManagementMenu isDeleting={isDeleting} onDelete={onDelete} onRename={onEditDetails} />
            ) : undefined
          }
          onAddAlbum={onAddAlbum}
          onEditingChange={onEditingChange}
        />
        {/* Matches the description's max width so the row rules align with the text above them. */}
        <div className="mt-6 max-w-2xl border-border border-t pt-1 lg:mt-8">
          {hasAlbums ? (
            <DndContext
              accessibility={{
                announcements: {
                  onDragCancel: ({ active }) => `Reordering ${getAlbumTitle(active.id)} was cancelled.`,
                  onDragEnd: ({ active, over }) =>
                    over
                      ? `${getAlbumTitle(active.id)} was moved to the position of ${getAlbumTitle(over.id)}.`
                      : `${getAlbumTitle(active.id)} was returned to its original position.`,
                  onDragOver: ({ active, over }) =>
                    over ? `${getAlbumTitle(active.id)} is over ${getAlbumTitle(over.id)}.` : undefined,
                  onDragStart: ({ active }) => `Picked up ${getAlbumTitle(active.id)}.`,
                },
                screenReaderInstructions,
              }}
              autoScroll={listAutoScroll}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              <SortableContext items={albumIds} strategy={verticalListSortingStrategy}>
                <ul>
                  {displayedAlbums.map((album, albumIndex) => (
                    <ListItemRow
                      album={album}
                      editing={isEditing}
                      index={albumIndex}
                      isRemoving={removingAlbumIds.has(album.id)}
                      key={album.id}
                      onRemove={onRemoveAlbum}
                      sortingDisabled={sortingDisabled}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ListPageEmpty canEdit={list.canEdit} onAddAlbum={onAddAlbum} />
          )}
        </div>
      </section>
    </PageContainerContent>
  );
}

function haveSameOrder(firstIds: string[], secondIds: string[]) {
  return firstIds.length === secondIds.length && firstIds.every((albumId, index) => albumId === secondIds[index]);
}

export function ListPageSkeleton() {
  return (
    <PageContainerContent
      aria-label="Loading list"
      className="grid max-w-285 gap-8 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] xl:gap-12"
      role="status"
    >
      <Skeleton className="hidden aspect-square w-full rounded-none lg:block" />
      <section className="min-w-0 lg:pt-10">
        {/* Same shape as the album header skeleton, including the inline cover below lg — otherwise
            the real mosaic lands after paint and shoves the whole page down. */}
        <div className="flex flex-col items-center gap-4 sm:grid sm:grid-cols-[144px_1fr] sm:items-end lg:block">
          <div className="lg:hidden">
            <Skeleton className="aspect-square w-44 rounded-none sm:w-full" />
          </div>
          <div className="min-w-0 sm:self-end lg:self-auto">
            <Skeleton className="h-7.5 w-full max-w-70 sm:h-9.5 lg:h-11 lg:max-w-4xl xl:h-14" />
          </div>
        </div>
        <Skeleton className="mx-auto mt-3 h-5 w-4/5 max-w-md sm:mx-0 lg:h-7 lg:max-w-80" />
        <Skeleton className="mx-auto mt-1.5 h-4 w-2/3 max-w-56 sm:mx-0 lg:h-5 lg:max-w-52" />
        <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2 lg:mt-6 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
          <Skeleton className="h-10 min-w-0 rounded-4xl lg:w-36" />
          <Skeleton className="size-10 rounded-4xl" />
          <Skeleton className="size-10 rounded-4xl" />
        </div>
        <div className="mt-8 flex max-w-2xl flex-col gap-3 border-border border-t pt-4">
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders
            <div className="flex items-center gap-3" key={index}>
              <Skeleton className="size-14 shrink-0 rounded-none" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageContainerContent>
  );
}

interface ListPageEmptyProps {
  canEdit: boolean;
  onAddAlbum: () => void;
}

// Shaped exactly like a real row so the page reads the same empty or full — the artwork slot just
// holds a plus instead of a cover.
function ListPageEmpty({ canEdit, onAddAlbum }: ListPageEmptyProps) {
  if (!canEdit) {
    return <EmptyState description="This list doesn't have any albums yet." title="Nothing here yet" />;
  }

  return (
    <div className={listRowClassName}>
      <button
        className="group/add-row focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-sm py-3 text-left outline-none"
        onClick={onAddAlbum}
        type="button"
      >
        <span className="flex size-14 shrink-0 items-center justify-center border border-border border-dashed bg-muted/40 text-muted-foreground [transition:background-color_150ms_ease,border-color_150ms_ease,color_150ms_ease] group-hover/add-row:border-primary/50 group-hover/add-row:bg-primary/10 group-hover/add-row:text-primary">
          <Plus className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground text-sm leading-snug">
            Add your first album
          </span>
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">Search Spotify to start this list</span>
        </span>
      </button>
    </div>
  );
}
