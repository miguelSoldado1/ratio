import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlbumListPickerDialog } from "@/components/list/album-list-picker-dialog";
import type { MyListForAlbum } from "@/server/services/list-service";

const lists: MyListForAlbum[] = [
  {
    containsAlbum: true,
    id: "already-added",
    itemCount: 3,
    title: "Already added",
  },
  {
    containsAlbum: false,
    id: "pending",
    itemCount: 4,
    title: "Pending list",
  },
  {
    containsAlbum: false,
    id: "full",
    itemCount: 100,
    title: "Full list",
  },
  {
    containsAlbum: false,
    id: "failed",
    itemCount: 2,
    title: "Failed list",
  },
  {
    containsAlbum: false,
    id: "available",
    itemCount: 1,
    title: "Available list",
  },
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlbumListPickerDialog", () => {
  it("opens added lists and only adds to available or failed lists", () => {
    const onOpenList = vi.fn();
    const onSelect = vi.fn();

    renderPicker({
      failedListIds: new Set(["failed"]),
      lists,
      onOpenList,
      onSelect,
      pendingListIds: new Set(["pending"]),
    });

    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.queryByText("Adding")).toBeNull();
    expect(screen.getByText("Full")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Open Already added" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Add album to Available list" })).toBeTruthy();

    fireEvent.click(screen.getByText("Already added"));
    fireEvent.click(screen.getByText("Pending list"));
    fireEvent.click(screen.getByText("Full list"));
    expect(onOpenList).toHaveBeenCalledWith("already-added");
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Failed list"));
    fireEvent.click(screen.getByText("Available list"));
    expect(onSelect).toHaveBeenNthCalledWith(1, lists[3]);
    expect(onSelect).toHaveBeenNthCalledWith(2, lists[4]);
  });

  it("offers list creation and pagination", () => {
    const onCreateList = vi.fn();
    const onLoadMore = vi.fn();

    renderPicker({
      hasNextPage: true,
      lists: [lists[4] as MyListForAlbum],
      onCreateList,
      onLoadMore,
    });

    fireEvent.click(screen.getByText("New list"));
    fireEvent.click(screen.getByText("Load more"));

    expect(onCreateList).toHaveBeenCalledOnce();
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("shows a useful empty state for an account without lists", () => {
    renderPicker({ lists: [] });

    expect(screen.getByText("No lists yet")).toBeTruthy();
    expect(screen.getByText("Create one here and this album will be added to it.")).toBeTruthy();
  });
});

function renderPicker(overrides: Partial<Parameters<typeof AlbumListPickerDialog>[0]> = {}) {
  return render(
    <AlbumListPickerDialog
      failedListIds={new Set()}
      hasNextPage={false}
      isFetchingNextPage={false}
      isLoading={false}
      lists={lists}
      loadError={false}
      onCreateList={vi.fn()}
      onLoadMore={vi.fn()}
      onOpenChange={vi.fn()}
      onOpenList={vi.fn()}
      onRetry={vi.fn()}
      onSelect={vi.fn()}
      open
      pendingListIds={new Set()}
      {...overrides}
    />
  );
}

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
