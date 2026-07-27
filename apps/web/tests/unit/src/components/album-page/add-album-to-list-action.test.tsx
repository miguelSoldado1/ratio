import { renderWithQueryClient } from "@test/react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddAlbumToListAction } from "@/components/album-page/add-album-to-list-action";
import { listQueryKeys } from "@/lib/tanstack-query/query-keys";

const mockAddListItem = vi.hoisted(() => vi.fn());
const mockCreateList = vi.hoisted(() => vi.fn());
const mockGetMyListsForAlbum = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const serverFns = vi.hoisted(() => ({
  addListItem: {},
  createList: {},
  getMyListsForAlbum: {},
}));
const sessionState = vi.hoisted(() => ({
  data: {
    user: {
      id: "viewer_1",
    },
  } as null | { user: { id: string } },
  isPending: false,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: object) => {
    if (serverFn === serverFns.addListItem) return mockAddListItem;
    if (serverFn === serverFns.createList) return mockCreateList;
    return mockGetMyListsForAlbum;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/server/functions/list-functions", () => serverFns);

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => sessionState,
  },
}));

vi.mock("@/components/auth/auth-dialog", () => ({
  AuthDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="auth-dialog">Sign in</div> : null),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  sessionState.data = { user: { id: "viewer_1" } };
  sessionState.isPending = false;
  mockAddListItem.mockReset();
  mockCreateList.mockReset();
  mockGetMyListsForAlbum.mockReset();
  mockNavigate.mockReset().mockResolvedValue(undefined);
  mockToastError.mockReset();
  mockGetMyListsForAlbum.mockResolvedValue({
    lists: [
      {
        containsAlbum: false,
        id: "list_1",
        itemCount: 2,
        title: "Headphone albums",
      },
    ],
    nextCursor: null,
  });
  mockAddListItem.mockResolvedValue({ added: true });
  mockCreateList.mockResolvedValue({
    id: "created_list",
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddAlbumToListAction", () => {
  it("opens authentication instead of loading lists for a signed-out user", () => {
    sessionState.data = null;

    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Add album to a list" }));

    expect(screen.getByTestId("auth-dialog")).toBeTruthy();
    expect(mockGetMyListsForAlbum).not.toHaveBeenCalled();
  });

  it("adds the album and updates the selected row in place", async () => {
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Add album to a list" }));
    fireEvent.click(await screen.findByText("Headphone albums"));

    await waitFor(() => {
      expect(mockAddListItem).toHaveBeenCalledWith(
        {
          data: {
            albumId: "album_1",
            listId: "list_1",
          },
        },
        expect.anything()
      );
    });
    expect(await screen.findByText("Added")).toBeTruthy();
    expect(screen.getByText("3 albums")).toBeTruthy();
  });

  it("creates a list and adds the current album to it", async () => {
    const { queryClient } = renderAction();
    const otherAlbumPickerKey = listQueryKeys.forAlbum("album_2", "viewer_1");
    queryClient.setQueryData(otherAlbumPickerKey, {
      pageParams: [null],
      pages: [{ lists: [], nextCursor: null }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Add album to a list" }));
    fireEvent.click(await screen.findByText("New list"));

    fireEvent.change(await screen.findByLabelText("Title"), {
      target: { value: "New favorites" },
    });
    expect(screen.getByText("0/200 characters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create list" }));

    await waitFor(() => {
      expect(mockCreateList).toHaveBeenCalledWith(
        {
          data: {
            description: null,
            title: "New favorites",
          },
        },
        expect.anything()
      );
    });
    await waitFor(() => {
      expect(mockAddListItem).toHaveBeenCalledWith(
        {
          data: {
            albumId: "album_1",
            listId: "created_list",
          },
        },
        expect.anything()
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      params: { listId: "created_list" },
      to: "/list/$listId",
    });
    expect(queryClient.getQueryState(otherAlbumPickerKey)?.isInvalidated).toBe(true);
  });

  it("still opens the newly created list when adding the album fails", async () => {
    mockAddListItem.mockRejectedValueOnce(new Error("Spotify is unavailable"));

    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Add album to a list" }));
    fireEvent.click(await screen.findByText("New list"));
    fireEvent.change(await screen.findByLabelText("Title"), {
      target: { value: "New favorites" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create list" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("List created without the album", {
        description: "Spotify is unavailable",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      params: { listId: "created_list" },
      to: "/list/$listId",
    });
  });

  it("allows an over-limit subtitle draft but does not submit it", async () => {
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Add album to a list" }));
    fireEvent.click(await screen.findByText("New list"));
    fireEvent.change(await screen.findByLabelText("Title"), {
      target: { value: "New favorites" },
    });

    const subtitle = await screen.findByLabelText("Subtitle");
    fireEvent.change(subtitle, { target: { value: "s".repeat(201) } });
    fireEvent.click(screen.getByRole("button", { name: "Create list" }));

    expect((subtitle as HTMLTextAreaElement).value).toHaveLength(201);
    expect(screen.getByText("201/200 characters")).toBeTruthy();
    expect(mockCreateList).not.toHaveBeenCalled();
  });
});

function renderAction() {
  return renderWithQueryClient(<AddAlbumToListAction albumId="album_1" albumTitle="Test Album" />);
}

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
