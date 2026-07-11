import { describe, expect, it } from "vitest";
import { computeInitialColumnFilters } from "@/hooks/use-query-table";

describe("query table filter state", () => {
  it("preserves text filters and multi-select arrays", () => {
    expect(
      computeInitialColumnFilters({
        album: "mf doom",
        empty: null,
        genres: ["hip-hop", "jazz"],
        trailingSpace: "mf ",
      })
    ).toEqual([
      { id: "album", value: "mf doom" },
      { id: "genres", value: ["hip-hop", "jazz"] },
      { id: "trailingSpace", value: "mf " },
    ]);
  });
});
