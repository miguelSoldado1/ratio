import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListPage } from "@/components/list/list-page";
import type { ReactNode } from "react";
import type { ListDetails } from "@/server/services/list-service";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const rankingNumberPattern = /^[12][.)]?$/;
const removeAlbumAccessibleNamePattern = /Remove .* from this list/;

const list: ListDetails = {
  albums: [
    {
      addedAt: new Date("2026-01-02T00:00:00.000Z"),
      artist: "Slint",
      coverUrl: "https://example.com/spiderland.jpg",
      id: "album-1",
      spotifyUrl: "https://open.spotify.com/album/album-1",
      title: "Spiderland",
      year: "1991",
    },
    {
      addedAt: new Date("2026-01-01T00:00:00.000Z"),
      artist: "Sufjan Stevens",
      coverUrl: "https://example.com/illinois.jpg",
      id: "album-2",
      spotifyUrl: "https://open.spotify.com/album/album-2",
      title: "Illinois",
      year: "2005",
    },
  ],
  author: {
    displayName: "Alice",
    id: "user-1",
    username: "alice",
  },
  canEdit: true,
  coverAlbums: [
    {
      coverUrl: "https://example.com/illinois.jpg",
      id: "album-2",
    },
    {
      coverUrl: "https://example.com/spiderland.jpg",
      id: "album-1",
    },
  ],
  description: "Records worth keeping close.",
  id: "00000000-0000-4000-8000-000000000001",
  title: "Lifers",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ListPage", () => {
  it("shows album management controls to the owner", () => {
    const onAddAlbum = vi.fn();
    const onEditingChange = vi.fn();
    const onRemoveAlbum = vi.fn();

    render(
      <ListPage
        canAddAlbum
        editing
        list={list}
        onAddAlbum={onAddAlbum}
        onDelete={vi.fn()}
        onEditDetails={vi.fn()}
        onEditingChange={onEditingChange}
        onRemoveAlbum={onRemoveAlbum}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add album" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Spiderland from this list" }));

    expect(onAddAlbum).toHaveBeenCalledOnce();
    expect(onEditingChange).toHaveBeenCalledWith(false);
    expect(onRemoveAlbum).toHaveBeenCalledWith("album-1");
    expect(screen.getByRole("button", { name: "Open list actions" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open Spiderland on Spotify" })).toBeNull();
  });

  it("hides every management control from a non-owner", () => {
    render(
      <ListPage
        canAddAlbum
        editing
        list={{ ...list, canEdit: false }}
        onAddAlbum={vi.fn()}
        onDelete={vi.fn()}
        onEditDetails={vi.fn()}
        onEditingChange={vi.fn()}
        onRemoveAlbum={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Add album" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit albums" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open list actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: removeAlbumAccessibleNamePattern })).toBeNull();
    expect(screen.getByRole("button", { name: "Share list" })).toBeTruthy();
  });

  it("renders album rows in order without visible ranking numbers", () => {
    const { container } = render(
      <ListPage
        canAddAlbum
        editing={false}
        list={list}
        onAddAlbum={vi.fn()}
        onDelete={vi.fn()}
        onEditDetails={vi.fn()}
        onEditingChange={vi.fn()}
        onRemoveAlbum={vi.fn()}
      />
    );

    const albumList = screen.getByText("Spiderland").closest("ul");
    expect(albumList).not.toBeNull();
    if (!albumList) return;

    const rows = within(albumList).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Spiderland");
    expect(rows[0]?.textContent).toContain("Added Jan 2, 2026");
    expect(rows[1]?.textContent).toContain("Illinois");
    expect(screen.getByRole("link", { name: "Open Spiderland on Spotify" }).getAttribute("href")).toBe(
      "https://open.spotify.com/album/album-1"
    );
    expect(container.querySelector("aside img")?.getAttribute("src")).toBe("https://example.com/illinois.jpg");
    expect(within(albumList).queryByText(rankingNumberPattern)).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  });

  it("disables album additions when the list is full", () => {
    render(
      <ListPage
        canAddAlbum={false}
        editing={false}
        list={list}
        onAddAlbum={vi.fn()}
        onDelete={vi.fn()}
        onEditDetails={vi.fn()}
        onEditingChange={vi.fn()}
        onRemoveAlbum={vi.fn()}
      />
    );

    expect((screen.getByRole("button", { name: "List full" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Add album" })).toBeNull();
  });
});
