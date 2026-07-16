import { renderWithQueryClient } from "@test/react";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecentRotation } from "@/components/recent-rotation/recent-rotation";

const mockServerFn = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    params,
    to,
  }: {
    children: React.ReactNode;
    className?: string;
    params: { albumId: string };
    to: string;
  }) => (
    <a className={className} data-to={to} href={`/album/${params.albumId}`}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => mockServerFn,
}));

vi.mock("@/server/functions/spotify-recent-rotation-functions", () => ({
  getMyRecentRotation: {},
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    linkSocial: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

beforeEach(() => {
  mockServerFn.mockReset();
});

describe("RecentRotation", () => {
  it("renders nothing and skips the query for anonymous users", () => {
    const { container } = renderWithQueryClient(<RecentRotation />);

    expect(container.innerHTML).toBe("");
    expect(mockServerFn).not.toHaveBeenCalled();
  });

  it("renders album tiles linking to Ratio album pages with Spotify attribution", async () => {
    mockServerFn.mockResolvedValue({
      albums: [
        createRotationAlbum({ id: "album_1", title: "First Album" }),
        createRotationAlbum({ id: "album_2", title: "Second Album" }),
      ],
      refreshedAt: "2026-07-10T10:00:00.000Z",
      status: "ready",
    });

    renderWithQueryClient(<RecentRotation viewerUserId="user_1" />);

    const shelfHeading = await screen.findByText("Albums from your recent listening");
    expect(shelfHeading.closest("section")?.classList.contains("recent-rotation-enter")).toBe(true);
    expect(shelfHeading.closest("section")?.querySelector("ul")?.className).toContain("xl:auto-cols-fr");
    expect(screen.getByText("First Album").closest("a")?.getAttribute("href")).toBe("/album/album_1");
    expect(screen.getByText("Second Album").closest("a")?.getAttribute("href")).toBe("/album/album_2");
    expect(screen.getAllByText("Artist One")).toHaveLength(2);
    expect(screen.getByLabelText("Open First Album on Spotify").getAttribute("href")).toBe(
      "https://open.spotify.com/album/album_1"
    );
    expect(screen.getByLabelText("Open Second Album on Spotify").getAttribute("href")).toBe(
      "https://open.spotify.com/album/album_2"
    );
  });

  it("renders nothing for a non-actionable unavailable result", async () => {
    mockServerFn.mockResolvedValue({ status: "unavailable" });

    const { container } = renderWithQueryClient(<RecentRotation viewerUserId="user_1" />);

    await waitFor(() => expect(mockServerFn).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).toBe(""));
    expect(screen.queryByRole("button", { name: "Reconnect Spotify" })).toBeNull();
  });

  it("renders the reconnect card when reauthorization is required", async () => {
    mockServerFn.mockResolvedValue({ status: "reconnect-required" });

    renderWithQueryClient(<RecentRotation viewerUserId="user_1" />);

    await screen.findByRole("button", { name: "Reconnect Spotify" });
    expect(screen.getByText("Reconnect Spotify to show your recent listening.")).toBeTruthy();
  });
});

function createRotationAlbum({ id, title }: { id: string; title: string }) {
  return {
    artistNames: ["Artist One"],
    coverUrl: "https://img.large",
    id,
    lastPlayedAt: "2026-07-10T09:00:00.000Z",
    spotifyUrl: `https://open.spotify.com/album/${id}`,
    title,
  };
}
