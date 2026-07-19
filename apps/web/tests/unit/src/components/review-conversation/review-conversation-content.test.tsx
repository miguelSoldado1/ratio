import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewConversationContent } from "@/components/review-conversation/review-conversation-content";
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from "react";

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
      href={to.replace("$albumId", params?.albumId ?? "").replace("$username", params?.username ?? "")}
      {...anchorProps}
    >
      {children}
    </a>
  ),
}));

const longReview = Array.from({ length: 40 }, (_, index) => `Sentence ${index} of a very long review.`).join(" ");
const showMorePattern = /Show more/;
const authorNamePattern = /Alice/;
const albumNamePattern = /In Rainbows/;

const review = {
  album: {
    artist: "Radiohead",
    coverUrl: "https://images.example/cover.jpg",
    id: "album-1",
    title: "In Rainbows",
    year: "2007",
  },
  canDelete: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: "review-1",
  liked: false,
  likes: 3,
  rating: 4.5,
  review: longReview,
  user: {
    avatarUrl: undefined,
    displayUsername: "Alice",
    username: "alice",
  },
};

describe("ReviewConversationContent", () => {
  it("renders the full review with the profile card's album row and actions", () => {
    renderContent();

    // The review is fully expanded page content: no collapse affordance.
    expect(screen.getByText(longReview)).toBeTruthy();
    expect(screen.queryByRole("button", { name: showMorePattern })).toBeNull();

    expect(screen.getByRole("link", { name: authorNamePattern }).getAttribute("href")).toBe("/user/alice");
    expect(screen.getByRole("img", { name: "4.5 out of 5 stars" })).toBeTruthy();

    // Likes · Reply · Share · Management action hierarchy.
    expect(screen.getByRole("button", { name: "Like review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reply to Alice's review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open review actions" })).toBeTruthy();

    expect(screen.getByRole("link", { name: albumNamePattern }).getAttribute("href")).toBe("/album/album-1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives the discussion its own labelled section with a count and composer", () => {
    renderContent();

    expect(screen.getByRole("heading", { level: 2, name: "Discussion (2)" })).toBeTruthy();

    const discussion = screen.getByRole("region", { name: "Discussion (2)" });
    expect(discussion.contains(screen.getByLabelText("Add a reply"))).toBe(true);
    expect(discussion.textContent).toContain("No replies yet. Start the discussion.");
  });

  it("focuses the composer from the root review reply action", () => {
    renderContent();

    fireEvent.click(screen.getByRole("button", { name: "Reply to Alice's review" }));

    expect(document.activeElement).toBe(screen.getByLabelText("Add a reply"));
  });

  it("offers a sign-in composer to anonymous visitors", () => {
    const onAuthRequired = vi.fn();
    renderContent({ onAuthRequired, viewer: { hasSession: false } });

    expect(screen.getByRole("button", { name: "Sign in to reply" })).toBeTruthy();
    expect(screen.queryByLabelText("Add a reply")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sign in to reply" }));
    expect(onAuthRequired).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Reply to Alice's review" }));
    expect(onAuthRequired).toHaveBeenCalledTimes(2);
  });

  it("trims a successful reply, clears the draft, and announces success", async () => {
    const onCreateReply = vi.fn().mockResolvedValue(null);
    renderContent({ onCreateReply });
    const textarea = screen.getByLabelText("Add a reply");

    fireEvent.change(textarea, { target: { value: "  Great point.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    await waitFor(() => expect(onCreateReply).toHaveBeenCalledWith("Great point."));
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe(""));
    expect(screen.getByRole("status").textContent).toContain("Reply posted.");
  });

  it("retains and marks the draft invalid when posting fails", async () => {
    const onCreateReply = vi.fn().mockResolvedValue("The reply could not be posted.");
    renderContent({ onCreateReply });
    const textarea = screen.getByLabelText("Add a reply");

    fireEvent.change(textarea, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect((await screen.findByRole("alert")).textContent).toContain("The reply could not be posted.");
    expect((textarea as HTMLTextAreaElement).value).toBe("Keep this draft");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
  });

  it("rejects whitespace-only replies without calling the mutation", async () => {
    const onCreateReply = vi.fn().mockResolvedValue(null);
    renderContent({ onCreateReply });

    fireEvent.change(screen.getByLabelText("Add a reply"), { target: { value: "   \n" } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Write a reply before posting.");
    expect(onCreateReply).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while preserving keyboard focus", async () => {
    let resolveSubmission: ((value: null) => void) | undefined;
    const onCreateReply = vi.fn(() => new Promise<null>((resolve) => (resolveSubmission = resolve)));
    renderContent({ onCreateReply });

    fireEvent.change(screen.getByLabelText("Add a reply"), { target: { value: "Only once" } });
    const submitButton = screen.getByRole("button", { name: "Reply" });
    submitButton.focus();
    fireEvent.click(submitButton);
    const pendingButton = await screen.findByRole("button", { name: "Reply" });
    fireEvent.click(pendingButton);

    expect(onCreateReply).toHaveBeenCalledOnce();
    expect(pendingButton.getAttribute("aria-disabled")).toBe("true");
    expect(pendingButton.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(pendingButton);
    expect((screen.getByLabelText("Add a reply") as HTMLTextAreaElement).readOnly).toBe(true);

    resolveSubmission?.(null);
    await waitFor(() => expect((screen.getByLabelText("Add a reply") as HTMLTextAreaElement).value).toBe(""));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reply" }));
  });
});

function renderContent(overrides: Partial<ComponentProps<typeof ReviewConversationContent>> = {}) {
  return render(
    <ReviewConversationContent
      deletingReplyId={null}
      deletingReviewId={null}
      hasNextReplyPage={false}
      isAdminMode={false}
      isCreatingReply={false}
      isFetchingNextReplyPage={false}
      isInitialRepliesError={false}
      isInitialRepliesLoading={false}
      isNextReplyPageError={false}
      loadMoreRepliesRef={{ current: null }}
      localReplyTail={[]}
      onAuthRequired={vi.fn()}
      onCreateReply={vi.fn().mockResolvedValue(null)}
      onDeleteReply={vi.fn().mockResolvedValue(true)}
      onDeleteReview={vi.fn().mockResolvedValue(true)}
      onLikeReply={vi.fn()}
      onRetryNextReplyPage={vi.fn()}
      onRetryReplies={vi.fn()}
      onReviewLikeToggle={vi.fn()}
      onShowReplyLikes={vi.fn()}
      onShowReviewLikes={vi.fn()}
      replies={[]}
      replyTotalCount={2}
      review={review}
      viewer={{ hasSession: true, userId: "user-1" }}
      {...overrides}
    />
  );
}
