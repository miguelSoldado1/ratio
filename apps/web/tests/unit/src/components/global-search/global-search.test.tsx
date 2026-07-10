import { renderWithQueryClient } from "@test/react";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "@/components/global-search/global-search";
import { recentSearchesStorageKey } from "@/components/global-search/recent-searches";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockServerFn = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mockServerFn,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null }),
  },
}));

vi.mock("@/server/functions/review-functions", () => ({
  searchUsers: {},
}));

vi.mock("@/server/functions/spotify-functions", () => ({
  searchAlbums: {},
}));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  localStorage.clear();
  mockNavigate.mockReset();
  mockServerFn.mockReset();
  mockServerFn.mockResolvedValue([]);
});

describe("GlobalSearch", () => {
  it("shows the empty search copy when there are no recent searches", () => {
    renderGlobalSearch();

    expect(screen.getByText("Search for albums or users")).toBeTruthy();
  });

  it("shows recent searches when the input is empty", () => {
    localStorage.setItem(
      recentSearchesStorageKey,
      JSON.stringify([{ normalizedQuery: "kid a", query: "Kid A", searchedAt: 1000 }])
    );

    renderGlobalSearch();

    expect(screen.getByText("Recent searches")).toBeTruthy();
    expect(screen.getByText("Kid A")).toBeTruthy();
  });

  it("fills the input when a recent search is selected", () => {
    localStorage.setItem(
      recentSearchesStorageKey,
      JSON.stringify([{ normalizedQuery: "kid a", query: "Kid A", searchedAt: 1000 }])
    );

    renderGlobalSearch();
    fireEvent.click(screen.getByText("Kid A"));

    expect((screen.getByPlaceholderText("Search...") as HTMLInputElement).value).toBe("Kid A");
  });

  it("removes a recent search without filling the input", () => {
    localStorage.setItem(
      recentSearchesStorageKey,
      JSON.stringify([{ normalizedQuery: "kid a", query: "Kid A", searchedAt: 1000 }])
    );

    renderGlobalSearch();
    fireEvent.click(screen.getByRole("button", { name: "Remove Kid A from recent searches" }));

    expect(screen.queryByText("Kid A")).toBeNull();
    expect(screen.getByText("Search for albums or users")).toBeTruthy();
    expect((screen.getByPlaceholderText("Search...") as HTMLInputElement).value).toBe("");
    expect(localStorage.getItem(recentSearchesStorageKey)).toBe("[]");
  });
});

function renderGlobalSearch() {
  return renderWithQueryClient(<GlobalSearch onOpenChange={vi.fn()} open />);
}

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
