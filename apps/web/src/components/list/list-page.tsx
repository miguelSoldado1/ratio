import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageContainerContent } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { tryCatch } from "@/try-catch";
import { ListCoverMosaic } from "./list-cover-mosaic";
import { ListHeader } from "./list-header";
import { ListItemRow } from "./list-item-row";
import { ListManagementMenu } from "./list-management-menu";
import { listRowClassName } from "./list-row-styles";
import type { Announcements, AutoScrollOptions, DragEndEvent } from "@dnd-kit/core";
import type { CSSProperties, RefObject } from "react";
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
  const headerColumnRef = useRef<HTMLDivElement>(null);
  const canPinHeader = useFitsBelowPinOffset(headerColumnRef);

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

  const announcements: Announcements = {
    onDragCancel: ({ active }) => `Reordering ${getAlbumTitle(active.id)} was cancelled.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${getAlbumTitle(active.id)} was moved to the position of ${getAlbumTitle(over.id)}.`
        : `${getAlbumTitle(active.id)} was returned to its original position.`,
    onDragOver: ({ active, over }) =>
      over ? `${getAlbumTitle(active.id)} is over ${getAlbumTitle(over.id)}.` : undefined,
    onDragStart: ({ active }) => `Picked up ${getAlbumTitle(active.id)}.`,
  };

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
    // Lists have no tracks to fill the cover column, so on desktop the header moves under the cover and the
    // right column is only the albums. Below lg it's one column: header (with its inline cover), then rows.
    <PageContainerContent className="grid max-w-285 gap-6 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] lg:gap-8 xl:gap-12">
      {/* Pinned only when cover + header fit the window; a long title or description would otherwise leave
          the action buttons below the fold for as long as the albums scroll. */}
      <div className={cn("min-w-0 lg:self-start", canPinHeader && "lg:sticky lg:top-20")} ref={headerColumnRef}>
        <ListCoverMosaic albums={list.coverAlbums} className="hidden w-full lg:grid" size={640} />
        <ListHeader
          canAddAlbum={canAddAlbum}
          className="lg:mt-6"
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
      </div>
      <section aria-label="Albums" className="min-w-0">
        <div className="max-w-2xl border-border border-t pt-1">
          {hasAlbums ? (
            <DndContext
              accessibility={{ announcements, screenReaderInstructions }}
              autoScroll={listAutoScroll}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              <SortableContext items={albumIds} strategy={verticalListSortingStrategy}>
                {/* Every rank cell is as wide as the longest number, so single-digit lists don't reserve
                    room for "100" on narrow screens. */}
                <ul style={{ "--rank-width": `${String(displayedAlbums.length).length}ch` } as CSSProperties}>
                  {displayedAlbums.map((album, albumIndex) => (
                    <ListItemRow
                      album={album}
                      editing={isEditing}
                      index={albumIndex}
                      isRemoving={removingAlbumIds.has(album.id)}
                      key={album.id}
                      onRemove={onRemoveAlbum}
                      rank={list.isRanked ? albumIndex + 1 : undefined}
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

// Matches lg:top-20 plus a little breathing room under the column.
const pinnedHeaderOffsetPx = 80 + 24;

function useFitsBelowPinOffset(ref: RefObject<HTMLElement | null>) {
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setFits(element.offsetHeight + pinnedHeaderOffsetPx <= window.innerHeight);
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);
    window.addEventListener("resize", update);
    update();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return fits;
}

function haveSameOrder(firstIds: string[], secondIds: string[]) {
  return firstIds.length === secondIds.length && firstIds.every((albumId, index) => albumId === secondIds[index]);
}

export function ListPageSkeleton() {
  return (
    <PageContainerContent
      aria-label="Loading list"
      className="grid max-w-285 gap-6 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] lg:gap-8 xl:gap-12"
      role="status"
    >
      <div className="min-w-0">
        <Skeleton className="hidden aspect-square w-full rounded-none lg:block" />
        {/* Same shape as the real header, including the inline cover below lg — otherwise the mosaic
            lands after paint and shoves the whole page down. */}
        <div className="flex flex-col items-center gap-4 sm:grid sm:grid-cols-[144px_1fr] sm:items-end lg:mt-6 lg:block">
          <div className="lg:hidden">
            <Skeleton className="aspect-square w-44 rounded-none sm:w-full" />
          </div>
          <div className="min-w-0 sm:self-end lg:self-auto">
            <Skeleton className="h-7.5 w-full max-w-70 sm:h-9.5 lg:h-11.25" />
          </div>
        </div>
        {/* Two lines of the desktop subtitle (24px each) fit in the same 48px the real text takes. */}
        <div className="mx-auto mt-3 max-w-md sm:mx-0 lg:flex lg:h-12 lg:max-w-none lg:flex-col lg:justify-around">
          <Skeleton className="mx-auto h-5 w-4/5 sm:mx-0 lg:w-full" />
          <Skeleton className="hidden h-5 w-3/5 lg:block" />
        </div>
        <Skeleton className="mx-auto mt-1.5 h-4 w-2/3 max-w-56 sm:mx-0 lg:h-5" />
        {/* One pill: the viewer's Share list button and the owner's button row both span this width. */}
        <Skeleton className="mt-5 h-10 w-full rounded-4xl sm:w-28 lg:w-full" />
      </div>
      <div className="max-w-2xl border-border border-t pt-1">
        {Array.from({ length: 5 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders
          <div className={listRowClassName} key={index}>
            {/* Title, artist and rating lines, plus the Spotify icon: the shape most real rows have. */}
            <div className="flex min-w-0 flex-1 items-center gap-3 py-3">
              <Skeleton className="size-14 shrink-0 rounded-none" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
            <div className="flex h-20 shrink-0 items-center">
              <Skeleton className="size-5.25 rounded-full" />
            </div>
          </div>
        ))}
      </div>
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
