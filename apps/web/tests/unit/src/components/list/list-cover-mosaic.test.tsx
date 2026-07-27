import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getFirstAddedCoverAlbums, ListCoverMosaic } from "@/components/list/list-cover-mosaic";
import type { ListCoverAlbum } from "@/server/services/list-service";

describe("ListCoverMosaic", () => {
  it("keeps the first-added album as the cover before mosaic mode", () => {
    const albums: ListCoverAlbum[] = [
      { coverUrl: "https://example.com/first-added.jpg", id: "first-added" },
      { coverUrl: "https://example.com/newest.jpg", id: "newest" },
    ];

    const { container } = render(<ListCoverMosaic albums={albums} size={320} />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/first-added.jpg");
  });

  it("uses the first four added albums when more albums exist", () => {
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

  it("keeps the first four covers when a fifth album is added newest-first", () => {
    const newestFirstAlbums = Array.from({ length: 5 }, (_, index) => {
      const albumNumber = 5 - index;

      return {
        coverUrl: `https://example.com/${albumNumber}.jpg`,
        id: `album-${albumNumber}`,
      };
    });

    expect(getFirstAddedCoverAlbums(newestFirstAlbums).map((album) => album.id)).toEqual([
      "album-1",
      "album-2",
      "album-3",
      "album-4",
    ]);
  });
});
