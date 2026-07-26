import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlbumPickerDialog } from "@/components/list/album-picker-dialog";
import { ListDetailsDialog } from "@/components/list/list-details-dialog";
import { ListPage } from "@/components/list/list-page";
import { getMockList, mockListSummaries } from "@/components/list/mock-data";
import { ProfileListsSection } from "@/components/list/profile-lists-section";
import { NotFoundPage } from "@/components/not-found-page";
import { PageContainer, PageContainerContent } from "@/components/page-container";
import { createCanonicalLink, createSeoMeta, siteName } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { AlbumResult } from "@/components/global-search/types";
import type { ListDetailsValues } from "@/components/list/list-details-dialog";
import type { ListDetails } from "@/components/list/types";

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
  const mockList = getMockList(listId);

  if (!mockList) {
    return <NotFoundPage />;
  }

  return <ListMock initialList={mockList} key={listId} />;
}

type MockPreview = "list" | "profile";

interface ListMockProps {
  initialList: ListDetails;
}

function ListMock({ initialList }: ListMockProps) {
  // Mock-only: ?view=profile / ?owner=false / ?edit=true / ?picker=true make each state linkable.
  // Read from the router location rather than window so server and client agree on the first render.
  const { searchStr } = useLocation();
  const mockSearch = new URLSearchParams(searchStr);

  const [list, setList] = useState(initialList);
  const [editing, setEditing] = useState(() => mockSearch.get("edit") === "true");
  const [pickerOpen, setPickerOpen] = useState(() => mockSearch.get("picker") === "true");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsVariant, setDetailsVariant] = useState<"create" | "edit">("edit");
  const [viewAsOwner, setViewAsOwner] = useState(() => mockSearch.get("owner") !== "false");
  const [preview, setPreview] = useState<MockPreview>(() =>
    mockSearch.get("view") === "profile" ? "profile" : "list"
  );

  const visibleList = { ...list, canEdit: list.canEdit && viewAsOwner };
  const addedAlbumIds = new Set(list.albums.map((album) => album.id));

  function handleAlbumSelect(album: AlbumResult) {
    setList((currentList) => ({
      ...currentList,
      albums: [
        ...currentList.albums,
        {
          artist: album.artists.map((artist) => artist.name).join(", "),
          coverUrl: album.image,
          id: album.id,
          title: album.name,
          year: album.releaseDate?.slice(0, 4) ?? "",
        },
      ],
      updatedAt: new Date(),
    }));
  }

  function handleRemoveAlbum(albumId: string) {
    const albums = list.albums.filter((album) => album.id !== albumId);

    if (albums.length === 0) {
      setEditing(false);
    }

    setList((currentList) => ({ ...currentList, albums, updatedAt: new Date() }));
  }

  function handleDetailsSubmit(values: ListDetailsValues) {
    setDetailsOpen(false);

    if (detailsVariant === "create") {
      return toast.success("List created", { description: `“${values.title}” — mock only, nothing was saved.` });
    }

    setList((currentList) => ({
      ...currentList,
      description: values.description || undefined,
      title: values.title,
      updatedAt: new Date(),
    }));
  }

  function handleDelete() {
    toast.success("List deleted", { description: "Mock only — reload to bring it back." });
  }

  function handleEditDetails() {
    setDetailsVariant("edit");
    setDetailsOpen(true);
  }

  function handleCreateList() {
    setDetailsVariant("create");
    setDetailsOpen(true);
  }

  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <PageContainer className="pb-24">
          {preview === "list" ? (
            <ListPage
              editing={editing}
              list={visibleList}
              onAddAlbum={() => setPickerOpen(true)}
              onDelete={handleDelete}
              onEditDetails={handleEditDetails}
              onEditingChange={setEditing}
              onRemoveAlbum={handleRemoveAlbum}
            />
          ) : (
            <PageContainerContent className="pt-4 lg:pt-7">
              <ProfileListsSection
                canCreate={viewAsOwner}
                lists={mockListSummaries}
                onCreateList={handleCreateList}
                profileDisplayName={list.author.displayName}
              />
            </PageContainerContent>
          )}
        </PageContainer>
      </main>
      <AlbumPickerDialog
        addedAlbumIds={addedAlbumIds}
        onOpenChange={setPickerOpen}
        onSelect={handleAlbumSelect}
        open={pickerOpen}
        remainingSlots={maxListItems - list.albums.length}
      />
      <ListDetailsDialog
        initialValues={
          detailsVariant === "edit" ? { description: list.description ?? "", title: list.title } : undefined
        }
        onOpenChange={setDetailsOpen}
        onSubmit={handleDetailsSubmit}
        open={detailsOpen}
        variant={detailsVariant}
      />
      <MockToolbar
        onPreviewChange={setPreview}
        onViewAsOwnerChange={setViewAsOwner}
        preview={preview}
        viewAsOwner={viewAsOwner}
      />
    </>
  );
}

interface MockToolbarProps {
  onPreviewChange: (preview: MockPreview) => void;
  onViewAsOwnerChange: (viewAsOwner: boolean) => void;
  preview: MockPreview;
  viewAsOwner: boolean;
}

function MockToolbar({ onPreviewChange, onViewAsOwnerChange, preview, viewAsOwner }: MockToolbarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-popover/95 px-2 py-1.5 shadow-lg backdrop-blur">
        <span className="px-1.5 font-medium text-2xs text-muted-foreground-subtle uppercase tracking-widest">Mock</span>
        <MockToggleGroup
          onChange={(value) => onPreviewChange(value as MockPreview)}
          options={[
            { label: "List page", value: "list" },
            { label: "Profile tab", value: "profile" },
          ]}
          value={preview}
        />
        <MockToggleGroup
          onChange={(value) => onViewAsOwnerChange(value === "owner")}
          options={[
            { label: "Owner", value: "owner" },
            { label: "Visitor", value: "visitor" },
          ]}
          value={viewAsOwner ? "owner" : "visitor"}
        />
      </div>
    </div>
  );
}

interface MockToggleGroupProps {
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}

function MockToggleGroup({ onChange, options, value }: MockToggleGroupProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5">
      {options.map((option) => (
        <button
          className={cn(
            "rounded-full px-2.5 py-1 font-medium text-xs outline-none [transition:background-color_150ms_ease,color_150ms_ease]",
            option.value === value ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
