import { pickCroppedImage } from "@test/image-crop";
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
const mockSetListCover = vi.hoisted(() => vi.fn());
const mockUploadCover = vi.hoisted(() => vi.fn());
const serverFns = vi.hoisted(() => ({
  createList: {},
  getUserLists: {},
  removeListCover: {},
  setListCover: {},
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: object) => {
    if (serverFn === serverFns.createList) return mockCreateList;
    if (serverFn === serverFns.setListCover) return mockSetListCover;
    return mockGetUserLists;
  },
}));

vi.mock("@better-upload/client", () => ({
  useUploadFile: () => ({ isPending: false, progress: 0, uploadAsync: mockUploadCover }),
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
  mockUploadCover.mockReset().mockResolvedValue({ file: { objectInfo: { key: "list-covers/new/cover.png" } } });
  mockSetListCover.mockReset().mockResolvedValue({
    cleanupFailed: false,
    coverUrl: "https://assets.example.com/list-covers/new/cover.png",
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  });
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

  it("uploads a picked cover once the new list exists", async () => {
    renderWithQueryClient(<ProfileListsTab active profileUser={profileUser} viewerUserId={profileUser.id} />);
    const cover = new File(["cover"], "cover.png", { type: "image/png" });

    fireEvent.click(await screen.findByRole("button", { name: "New list" }));
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Covered" } });
    await pickCroppedImage("Cover", cover);
    expect(mockUploadCover).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Create list" }));

    const listId = "00000000-0000-4000-8000-000000000001";
    await waitFor(() => expect(mockUploadCover).toHaveBeenCalledWith(cover, { metadata: { listId } }));
    await waitFor(() =>
      expect(mockSetListCover).toHaveBeenCalledWith(
        { data: { listId, objectKey: "list-covers/new/cover.png" } },
        expect.anything()
      )
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
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
