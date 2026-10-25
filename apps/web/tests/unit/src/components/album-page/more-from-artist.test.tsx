import { renderWithQueryClient } from "@test/react";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoreFromArtist } from "@/components/album-page/more-from-artist";
import { getContext } from "@/lib/tanstack-query/root-provider";
import type { ComponentProps } from "react";

const mockServerFn = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to: _to,
    ...props
  }: ComponentProps<"a"> & { params: { albumId: string }; to: string }) => (
    <a href={`/album/${params.albumId}`} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mockServerFn }));
vi.mock("@/server/functions/spotify-functions", () => ({ getArtistAlbums: {} }));

const album: ComponentProps<typeof MoreFromArtist>["album"] = {
  id: "current",
  title: "In Rainbows (Explicit)",
  albumType: "album",
  artists: [{ id: "artist_1", name: "Radiohead", spotifyUrl: "https://open.spotify.com/artist/artist_1" }],
  releaseDate: "2007-10-10",
  totalTracks: 10,
  coverUrl: null,
  durationMs: 0,
  genre: null,
  label: "",
  spotifyUrl: "https://open.spotify.com/album/current",
};

beforeEach(() => mockServerFn.mockReset());

describe("MoreFromArtist", () => {
  it("renders the server's albums as Ratio and Spotify links", async () => {
    mockServerFn.mockResolvedValue(
      ["Kid A", "OK Computer", "The Bends", "Amnesiac"].map((title, index) => createCandidate(`other_${index}`, title))
    );
    const { queryClient } = getContext();
    renderWithQueryClient(<MoreFromArtist album={album} />, queryClient);

    await screen.findByRole("heading", { name: "More from Radiohead" });
    expect(mockServerFn).toHaveBeenCalledExactlyOnceWith({ data: { albumId: "current", artistId: "artist_1" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Kid A" }).getAttribute("href")).toBe("/album/other_0");
    expect(screen.getByLabelText("Open Kid A on Spotify").getAttribute("href")).toBe(
      "https://open.spotify.com/album/other_0"
    );
    queryClient.clear();
  });

  it("omits the shelf when the server has no other albums", async () => {
    mockServerFn.mockResolvedValue([]);
    const { queryClient } = getContext();
    const { container } = renderWithQueryClient(<MoreFromArtist album={album} />, queryClient);

    await waitFor(() => expect(mockServerFn).toHaveBeenCalledOnce());
    expect(container.querySelector("section")).toBeNull();
    queryClient.clear();
  });

  it("does not request artist albums without a credited artist", () => {
    const { container } = renderWithQueryClient(<MoreFromArtist album={{ ...album, artists: [] }} />);

    expect(container.innerHTML).toBe("");
    expect(mockServerFn).not.toHaveBeenCalled();
  });
});

function createCandidate(id: string, title: string) {
  return {
    id,
    title,
    releaseYear: "2000",
    coverUrl: null,
    spotifyUrl: `https://open.spotify.com/album/${id}`,
  };
}
