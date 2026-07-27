import { renderWithQueryClient } from "@test/react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileListsTab } from "@/components/profile/profile-lists-tab";
import { listQueryKeys } from "@/lib/tanstack-query/query-keys";
import type { ReactNode } from "react";
import type { UserProfile } from "@/server/services/review-service";

const mockCreateList = vi.hoisted(() => vi.fn());
const mockGetUserLists = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const serverFns = vi.hoisted(() => ({
  createList: {},
  getUserLists: {},
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: object) => (serverFn === serverFns.createList ? mockCreateList : mockGetUserLists),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock("@/server/functions/list-functions", () => serverFns);

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const profileUser: UserProfile["user"] = {
  avatarObjectKey: undefined,
  avatarUrl: undefined,
  banned: false,
  canEdit: true,
  displayName: "Alice",
  displayUsername: "alice",
  followedByViewer: false,
  id: "user_1",
  username: "alice",
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  mockCreateList.mockReset().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000001",
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  mockGetUserLists.mockReset().mockResolvedValue({ lists: [], nextCursor: null });
  mockNavigate.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileListsTab", () => {
  it("invalidates every album picker after creating a list", async () => {
    const { queryClient } = renderWithQueryClient(
      <ProfileListsTab active profileUser={profileUser} viewerUserId={profileUser.id} />
    );
    const albumPickerKey = listQueryKeys.forAlbum("album_1", profileUser.id);
    queryClient.setQueryData(albumPickerKey, {
      pageParams: [null],
      pages: [{ lists: [], nextCursor: null }],
    });

    fireEvent.click(await screen.findByRole("button", { name: "New list" }));
    fireEvent.change(await screen.findByLabelText("Title"), {
      target: { value: "Headphone albums" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create list" }));

    await waitFor(() => expect(mockCreateList).toHaveBeenCalled());
    await waitFor(() => expect(queryClient.getQueryState(albumPickerKey)?.isInvalidated).toBe(true));
  });

  it("does not mount creation controls for a non-owner", async () => {
    renderWithQueryClient(
      <ProfileListsTab active profileUser={{ ...profileUser, canEdit: false }} viewerUserId="viewer_2" />
    );

    await screen.findByText("No lists yet");
    expect(screen.queryByRole("button", { name: "New list" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
