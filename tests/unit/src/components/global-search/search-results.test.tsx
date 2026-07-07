import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchResults } from "@/components/global-search/search-results";
import { Command } from "@/components/ui/command";
import type { AlbumResult, UserResult } from "@/components/global-search/types";

const album = {
  albumType: "album",
  artists: [{ id: "artist_1", name: "Artist One" }],
  id: "album_1",
  image: "https://example.com/cover.jpg",
  name: "Album One",
  releaseDate: "2026-01-01",
  spotifyUrl: "https://open.spotify.com/album/album_1",
} satisfies AlbumResult;

const user = {
  avatarUrl: "https://example.com/avatar.jpg",
  displayUsername: "Alice",
  username: "alice",
} satisfies UserResult;

describe("SearchResults", () => {
  it("renders loading and empty states", () => {
    const { rerender } = renderSearch({ isFetchingAlbums: true });
    expect(screen.getByRole("status", { name: "Loading search results" })).toBeTruthy();

    rerender(renderSearchElement({ debouncedQuery: "nothing" }));
    expect(screen.getByText('No results for "nothing"')).toBeTruthy();

    rerender(renderSearchElement());
    expect(screen.getByText("Search for albums or users")).toBeTruthy();
  });

  it("does not show no-results copy before search is enabled", () => {
    renderSearch({ debouncedQuery: "a" });

    expect(screen.getByText("Search for albums or users")).toBeTruthy();
  });

  it("renders an album search error state", () => {
    renderSearch({
      albumSearchError: new Error("Spotify rate limit reached, try again shortly"),
      debouncedQuery: "radiohead",
    });

    expect(screen.getByText("Spotify rate limit reached, try again shortly")).toBeTruthy();
  });

  it("renders results and calls select callbacks", () => {
    const onSelect = vi.fn();
    const onUserSelect = vi.fn();
    renderSearch({ albumResults: [album], onSelect, onUserSelect, userResults: [user] });

    fireEvent.click(screen.getByText("Album One"));
    expect(onSelect).toHaveBeenCalledWith(album);

    fireEvent.click(screen.getByText("Alice"));
    expect(onUserSelect).toHaveBeenCalledWith(user);
  });

  it("dims existing album results while a new album search is pending", () => {
    renderSearch({ albumResults: [album], isFetchingAlbums: true });

    expect(screen.getByText("Album One").closest("[data-slot='command-item']")?.className).toContain("opacity-55");
    expect(screen.getByRole("status", { name: "Loading search results" })).toBeTruthy();
  });

  it("builds Spotify attribution link from the query", () => {
    renderSearch({ albumResults: [album], debouncedQuery: "radio head" });

    expect(screen.getByLabelText("Open search results on Spotify").getAttribute("href")).toBe(
      "https://open.spotify.com/search/radio%20head/albums"
    );
  });
});

function renderSearch(overrides: Partial<Parameters<typeof SearchResults>[0]> = {}) {
  return render(renderSearchElement(overrides));
}

function renderSearchElement(overrides: Partial<Parameters<typeof SearchResults>[0]> = {}) {
  return (
    <Command>
      <SearchResults
        albumResults={[]}
        albumSearchError={null}
        debouncedQuery=""
        isFetchingAlbums={false}
        isFetchingUsers={false}
        onSelect={vi.fn()}
        onUserSelect={vi.fn()}
        userResults={[]}
        {...overrides}
      />
    </Command>
  );
}
