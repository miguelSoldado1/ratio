import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewCard } from "@/components/review-card";
import { ReviewRow } from "@/components/review-list";
import type { AnchorHTMLAttributes, ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    to,
    ...anchorProps
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    params?: Record<string, string>;
    to: string;
  }) => (
    <a
      href={to
        .replace("$albumId", params?.albumId ?? "")
        .replace("$reviewId", params?.reviewId ?? "")
        .replace("$username", params?.username ?? "")}
      {...anchorProps}
    >
      {children}
    </a>
  ),
}));

const albumLinkNamePattern = /Album\s+Artist/;
const reviewTimeLinkNamePattern = /Open Alice's review from/;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReviewCard.Replies", () => {
  it("renders no reply control when the surface did not hydrate replies", () => {
    renderReplies({ replyCount: undefined });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("links an empty thread to the standalone discussion", () => {
    renderReplies({ replyCount: 0 });

    expect(screen.getByRole("link", { name: "View discussion of Alice's review" }).getAttribute("href")).toBe(
      "/review/review-1"
    );
    const discussionLink = screen.getByRole("link", { name: "View discussion of Alice's review, 0 replies" });
    expect(discussionLink.getAttribute("href")).toBe("/review/review-1");
    expect(discussionLink.textContent).toContain("0");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the reply count as a View discussion link when the thread has replies", () => {
    renderReplies({ replyCount: 4 });

    const discussionLink = screen.getByRole("link", { name: "View discussion of Alice's review, 4 replies" });
    expect(discussionLink.getAttribute("href")).toBe("/review/review-1");
    expect(discussionLink.textContent).toContain("4");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute("href") === "/review/review-1")).toBe(true);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("review row discussion slots", () => {
  it("exposes the discussion link next to the like control on a rating-only review", () => {
    render(
      <ReviewRow
        onReviewLikeToggle={() => undefined}
        renderReplies={() => <ReviewCard.Replies replyCount={0} reviewAuthorName="Alice" reviewId="review-1" />}
        resolveUser={() => ({ displayUsername: "Alice", username: "alice" })}
        review={{
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          id: "review-1",
          liked: false,
          likes: 0,
          rating: 4,
        }}
        viewer={{ hasSession: false }}
      />
    );

    const discussionLink = screen.getByRole("link", { name: "View discussion of Alice's review" });
    const likeButton = screen.getByRole("button", { name: "Like review" });
    // Siblings in the same footer, with the like control first.
    expect(discussionLink.compareDocumentPosition(likeButton)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    expect(discussionLink.parentElement?.parentElement).toBe(likeButton.parentElement?.parentElement ?? null);
  });

  it("keeps album navigation separate while linking review text and time to the permalink", () => {
    render(
      <ReviewRow
        onReviewLikeToggle={() => undefined}
        resolvePermalink={() => ({ reviewAuthorName: "Alice", reviewId: "review-1" })}
        resolveUser={() => ({ displayUsername: "Alice", username: "alice" })}
        review={{
          album: { artist: "Artist", id: "album-1", title: "Album", year: "2026" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          id: "review-1",
          liked: false,
          likes: 0,
          rating: 4,
          review: "The review itself opens its discussion.",
        }}
        viewer={{ hasSession: false }}
      />
    );

    expect(screen.getByRole("link", { name: albumLinkNamePattern }).getAttribute("href")).toBe("/album/album-1");
    expect(screen.getByRole("link", { name: "Open Alice's review" }).getAttribute("href")).toBe("/review/review-1");
    expect(screen.getByRole("link", { name: reviewTimeLinkNamePattern }).getAttribute("href")).toBe("/review/review-1");
  });
});

function renderReplies({ replyCount }: { replyCount?: number }) {
  return render(<ReviewCard.Replies replyCount={replyCount} reviewAuthorName="Alice" reviewId="review-1" />);
}
