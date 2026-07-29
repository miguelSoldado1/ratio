import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getLeadingCoverAlbums, ListCoverMosaic } from "@/components/list/list-cover-mosaic";
import type { ListCoverAlbum } from "@/server/services/list-service";

describe("ListCoverMosaic", () => {
  it("keeps the leading album as the cover before mosaic mode", () => {
    const albums: ListCoverAlbum[] = [
      { coverUrl: "https://example.com/first-added.jpg", id: "first-added" },
      { coverUrl: "https://example.com/newest.jpg", id: "newest" },
    ];

    const { container } = render(<ListCoverMosaic albums={albums} size={320} />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/first-added.jpg");
  });

  it("uses the first four positioned albums when more albums exist", () => {
    const albums = Array.from({ length: 5 }, (_, index) => ({
      coverUrl: `https://example.com/${index + 1}.jpg`,
      id: `album-${index + 1}`,
    }));

    const { container } = render(<ListCoverMosaic albums={albums} size={320} />);

    expect(Array.from(container.querySelectorAll("img"), (image) => image.getAttribute("src"))).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      "https://example.com/3.jpg",
      "https://example.com/4.jpg",
    ]);
  });

  it("keeps the leading four covers when the visible order changes", () => {
    const albums = Array.from({ length: 5 }, (_, index) => ({
      coverUrl: `https://example.com/${index + 1}.jpg`,
      id: `album-${index + 1}`,
    }));

    expect(getLeadingCoverAlbums(albums).map((album) => album.id)).toEqual([
      "album-1",
      "album-2",
      "album-3",
      "album-4",
    ]);
  });
});
