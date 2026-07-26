import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainerContent } from "@/components/page-container";
import { ListCoverMosaic } from "./list-cover-mosaic";
import { ListHeader } from "./list-header";
import { ListItemRow, listRowClassName } from "./list-item-row";
import { ListManagementMenu } from "./list-management-menu";
import type { ListDetails } from "./types";

interface ListPageProps {
  editing: boolean;
  list: ListDetails;
  onAddAlbum: () => void;
  onDelete: () => void;
  onEditDetails: () => void;
  onEditingChange: (editing: boolean) => void;
  onRemoveAlbum: (albumId: string) => void;
}

export function ListPage({
  editing,
  list,
  onAddAlbum,
  onDelete,
  onEditDetails,
  onEditingChange,
  onRemoveAlbum,
}: ListPageProps) {
  const isEditing = editing && list.canEdit;

  return (
    <PageContainerContent className="grid gap-8 py-6 lg:grid-cols-[minmax(240px,340px)_1fr] xl:gap-12">
      {/* Cover lives inline in the header below the two-column breakpoint, matching the album page. */}
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <ListCoverMosaic albums={list.albums} className="w-full rounded-2xl" size={640} />
      </aside>
      <section className="min-w-0 lg:pt-10">
        <ListHeader
          editing={isEditing}
          list={list}
          managementMenu={
            list.canEdit ? <ListManagementMenu onDelete={onDelete} onRename={onEditDetails} /> : undefined
          }
          onAddAlbum={onAddAlbum}
          onEditingChange={onEditingChange}
        />
        {/* Matches the description's max width so the row rules align with the text above them. */}
        <div className="mt-6 max-w-2xl border-border border-t pt-1 lg:mt-8">
          {list.albums.length === 0 ? (
            <ListPageEmpty canEdit={list.canEdit} onAddAlbum={onAddAlbum} />
          ) : (
            <ul>
              {list.albums.map((album, albumIndex) => (
                <ListItemRow
                  album={album}
                  editing={isEditing}
                  index={albumIndex}
                  key={album.id}
                  onRemove={onRemoveAlbum}
                />
              ))}
            </ul>
          )}
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
