import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecentSearches,
  recentSearchesStorageKey,
  removeRecentSearch,
  saveRecentSearch,
} from "@/components/global-search/recent-searches";

beforeEach(() => {
  localStorage.clear();
});

describe("recent searches", () => {
  it("saves a valid query", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);

    expect(saveRecentSearch("Radiohead")).toEqual([
      {
        normalizedQuery: "radiohead",
        query: "Radiohead",
        searchedAt: 1000,
      },
    ]);
    expect(getRecentSearches()).toEqual([
      {
        normalizedQuery: "radiohead",
        query: "Radiohead",
        searchedAt: 1000,
      },
    ]);
  });

  it("ignores empty and one-character queries", () => {
    expect(saveRecentSearch(" ")).toEqual([]);
    expect(saveRecentSearch("a")).toEqual([]);
    expect(getRecentSearches()).toEqual([]);
  });

  it("dedupes normalized duplicates and preserves the latest display casing", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    saveRecentSearch("radio   head");
    saveRecentSearch("Radio Head");

    expect(getRecentSearches()).toEqual([
      {
        normalizedQuery: "radio head",
        query: "Radio Head",
        searchedAt: 2000,
      },
    ]);
  });

  it("moves repeated queries to the top", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(2000).mockReturnValueOnce(3000);

    saveRecentSearch("Radiohead");
    saveRecentSearch("Beyonce");
    saveRecentSearch("radiohead");

    expect(getRecentSearches().map((search) => search.query)).toEqual(["radiohead", "Beyonce"]);
  });

  it("caps recent searches at 10 items", () => {
    let timestamp = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      timestamp += 1;
      return timestamp;
    });

    for (let index = 0; index < 12; index += 1) {
      saveRecentSearch(`query ${index}`);
    }

    const searches = getRecentSearches();

    expect(searches).toHaveLength(10);
    expect(searches.map((search) => search.query)).toEqual([
      "query 11",
      "query 10",
      "query 9",
      "query 8",
      "query 7",
      "query 6",
      "query 5",
      "query 4",
      "query 3",
      "query 2",
    ]);
  });

  it("returns an empty list for invalid localStorage JSON", () => {
    localStorage.setItem(recentSearchesStorageKey, "not-json");

    expect(getRecentSearches()).toEqual([]);
  });

  it("removes a recent search by normalized query", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    saveRecentSearch("Radiohead");
    saveRecentSearch("Beyonce");

    expect(removeRecentSearch("radiohead").map((search) => search.query)).toEqual(["Beyonce"]);
    expect(getRecentSearches().map((search) => search.query)).toEqual(["Beyonce"]);
  });
});
