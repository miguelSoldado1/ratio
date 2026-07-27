import { renderWithQueryClient } from "@test/react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlbumPickerDialog } from "@/components/list/album-picker-dialog";
import type { AlbumResult } from "@/components/global-search/types";

const mockServerFn = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mockServerFn,
}));

vi.mock("@/server/functions/spotify-functions", () => ({
  searchAlbums: {},
}));

const albums: AlbumResult[] = [
  {
    albumType: "album",
    artists: [{ id: "artist-1", name: "Slint" }],
    id: "album-1",
    image: "https://example.com/spiderland.jpg",
    name: "Spiderland",
    releaseDate: "1991-03-27",
    spotifyUrl: "https://open.spotify.com/album/album-1",
  },
  {
    albumType: "album",
    artists: [{ id: "artist-2", name: "My Bloody Valentine" }],
    id: "album-2",
    image: "https://example.com/loveless.jpg",
    name: "Loveless",
    releaseDate: "1991-11-04",
    spotifyUrl: "https://open.spotify.com/album/album-2",
  },
  {
    albumType: "album",
    artists: [{ id: "artist-3", name: "Sufjan Stevens" }],
    id: "album-3",
    image: "https://example.com/illinois.jpg",
    name: "Illinois",
    releaseDate: "2005-07-04",
    spotifyUrl: "https://open.spotify.com/album/album-3",
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  mockServerFn.mockReset().mockResolvedValue(albums);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AlbumPickerDialog", () => {
  it("waits for the debounce and minimum query length before searching", async () => {
    renderPicker();
    const input = screen.getByPlaceholderText("Search albums...");

    fireEvent.change(input, { target: { value: "a" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(mockServerFn).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "ab" } });
    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(mockServerFn).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    vi.useRealTimers();
    await waitFor(() => expect(mockServerFn).toHaveBeenCalledWith({ data: { query: "ab" } }));
  });

  it("shows added and failed states, disables pending albums, and stays open after a successful retry", async () => {
    const onOpenChange = vi.fn();
    const onSelect = vi.fn().mockResolvedValue(true);

    renderPicker({
      addedAlbumIds: new Set(["album-1"]),
      failedAlbumIds: new Set(["album-3"]),
      onOpenChange,
      onSelect,
      pendingAlbumIds: new Set(["album-2"]),
    });

    fireEvent.change(screen.getByPlaceholderText("Search albums..."), { target: { value: "albums" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    await act(() => vi.advanceTimersByTimeAsync(1));
    vi.useRealTimers();

    expect(await screen.findByText("Added")).toBeTruthy();
    expect(screen.queryByText("Adding")).toBeNull();
    expect(screen.getByText("Retry")).toBeTruthy();
    expect(screen.getByText("Results from")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open search results on Spotify" }).getAttribute("href")).toBe(
      "https://open.spotify.com/search/albums/albums"
    );
    fireEvent.click(screen.getByText("Loveless"));
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Illinois"));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(albums[2]));
    await waitFor(() => expect(screen.getByText("1 album added · 100 slots left")).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("disables search results when the list is full", async () => {
    const onSelect = vi.fn().mockResolvedValue(true);

    renderPicker({ onSelect, remainingSlots: 0 });
    fireEvent.change(screen.getByPlaceholderText("Search albums..."), { target: { value: "albums" } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    await act(() => vi.advanceTimersByTimeAsync(1));
    vi.useRealTimers();

    await waitFor(() => expect(mockServerFn).toHaveBeenCalledWith({ data: { query: "albums" } }));
    const result = await screen.findByText("Spiderland");
    fireEvent.click(result);

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("This list is full.")).toBeTruthy();
  });
});

function renderPicker(overrides: Partial<Parameters<typeof AlbumPickerDialog>[0]> = {}) {
  return renderWithQueryClient(
    <AlbumPickerDialog
      addedAlbumIds={new Set()}
      onOpenChange={vi.fn()}
      onSelect={vi.fn().mockResolvedValue(true)}
      open
      remainingSlots={100}
      {...overrides}
    />
  );
}

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
