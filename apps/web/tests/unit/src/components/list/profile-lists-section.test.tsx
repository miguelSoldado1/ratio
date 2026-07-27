import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileListsSection } from "@/components/list/profile-lists-section";
import type { ReactNode } from "react";
import type { ListSummary } from "@/server/services/list-service";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const list: ListSummary = {
  author: {
    displayName: "Alice",
    id: "user_1",
    username: "alice",
  },
  coverAlbums: [{ coverUrl: "https://example.com/cover.jpg", id: "album_1" }],
  id: "00000000-0000-4000-8000-000000000001",
  itemCount: 1,
  title: "Headphone albums",
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

describe("ProfileListsSection", () => {
  it("hides list creation from a non-owner empty state", () => {
    render(<ProfileListsSection canCreate={false} lists={[]} onCreateList={vi.fn()} profileDisplayName="Alice" />);

    expect(screen.queryByRole("button", { name: "New list" })).toBeNull();
    expect(screen.queryByText("canCreate && (")).toBeNull();
  });

  it("offers list creation to the profile owner", () => {
    const onCreateList = vi.fn();

    render(<ProfileListsSection canCreate lists={[]} onCreateList={onCreateList} profileDisplayName="Alice" />);
    fireEvent.click(screen.getByRole("button", { name: "New list" }));

    expect(onCreateList).toHaveBeenCalledOnce();
  });

  it("does not render Spotify attribution on profile list summaries", () => {
    render(<ProfileListsSection canCreate={false} lists={[list]} onCreateList={vi.fn()} profileDisplayName="Alice" />);

    expect(screen.queryByRole("link", { name: "Album artwork provided by Spotify" })).toBeNull();
  });
});
