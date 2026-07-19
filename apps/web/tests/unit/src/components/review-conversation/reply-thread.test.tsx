import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReplyThread } from "@/components/review-conversation/reply-thread";
import type { ReviewReply } from "@/lib/tanstack-query/review-reply-cache";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/profile">{children}</a>,
}));

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    window.setTimeout(() => callback(0), 0);
    return 0;
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("ReplyThread", () => {
  it("renders a labelled ordered list with entity-specific like controls", () => {
    const onLikeToggle = vi.fn();
    renderThread({ onLikeToggle, replies: [createReply({ liked: true, likes: 2 })], totalCount: 1 });

    expect(screen.getByRole("heading", { name: "Discussion (1)" })).toBeTruthy();
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByRole("article")).toBeTruthy();
    expect(screen.getByText("A thoughtful reply")).toBeTruthy();
    expect(screen.getByText("just now").tagName).toBe("TIME");
    expect(screen.getByRole("button", { name: "Unlike reply by Alice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Show people who liked this reply by Alice, 2 likes" })).toBeTruthy();
  });

  it("keeps loaded replies visible and exposes Retry after load-more fails", () => {
    const onRetryNextPage = vi.fn();
    renderThread({ hasNextPage: true, isNextPageError: true, onRetryNextPage, replies: [createReply()] });

    expect(screen.getByText("A thoughtful reply")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading replies" }));
    expect(onRetryNextPage).toHaveBeenCalledOnce();
  });

  it("renders the local reply section immediately below the composer", () => {
    renderThread({
      composer: <textarea aria-label="Add a reply" />,
      hasNextPage: true,
      localTail: [createReply({ body: "Posted locally", id: "reply-z" })],
      replies: [createReply()],
      totalCount: 2,
    });

    expect(screen.queryByRole("button", { name: "Load more replies" })).toBeNull();
    expect(document.querySelector('[data-slot="reply-pagination-sentinel"]')).not.toBeNull();
    expect(screen.getByRole("list", { name: "Your reply" })).toBeTruthy();
    expect(screen.getByText("Posted locally")).toBeTruthy();
    expect(screen.getByLabelText("Add a reply").compareDocumentPosition(screen.getByText("Posted locally"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("reveals and focuses a newly posted reply", async () => {
    renderThread({
      localTail: [createReply({ id: "reply-z" })],
      replyToRevealId: "reply-z",
    });

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("article")));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  it("announces continuation loading and exposes the thread busy state", () => {
    renderThread({ hasNextPage: true, isFetchingNextPage: true });

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Loading more replies");
    expect(status.getAttribute("aria-busy")).toBe("true");
  });

  it("preserves the review flow with a retryable initial error", () => {
    const onRetryInitial = vi.fn();
    renderThread({ isInitialError: true, onRetryInitial });

    expect(screen.getByRole("alert").textContent).toContain("Replies unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryInitial).toHaveBeenCalledOnce();
  });

  it("moves focus to the next reply after deletion", async () => {
    const first = createReply({ canDelete: true });
    const second = createReply({ canDelete: true, id: "reply-b" });
    renderThread({ onDelete: vi.fn().mockResolvedValue(true), replies: [first, second], totalCount: 2 });

    fireEvent.click(screen.getAllByRole("button", { name: "Open reply actions" })[0] as HTMLButtonElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete reply" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete your reply?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete reply" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete your reply?" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("article")[1]));
  });
});

function renderThread(overrides: Partial<React.ComponentProps<typeof ReplyThread>> = {}) {
  return render(
    <ReplyThread
      deletingReplyId={null}
      hasNextPage={false}
      hasSession
      isAdminMode={false}
      isFetchingNextPage={false}
      isInitialError={false}
      isInitialLoading={false}
      isNextPageError={false}
      loadMoreRef={{ current: null }}
      localTail={[]}
      onDelete={vi.fn().mockResolvedValue(true)}
      onLikeToggle={vi.fn()}
      onRetryInitial={vi.fn()}
      onRetryNextPage={vi.fn()}
      onShowLikes={vi.fn()}
      replies={[]}
      replyToRevealId={undefined}
      totalCount={0}
      {...overrides}
    />
  );
}

function createReply(overrides: Partial<ReviewReply> = {}): ReviewReply {
  return {
    body: "A thoughtful reply",
    canDelete: false,
    createdAt: new Date(),
    id: "reply-a",
    liked: false,
    likes: 0,
    reviewId: "review-a",
    user: {
      avatarUrl: null,
      displayUsername: "Alice",
      id: "user-a",
      username: "alice",
    },
    ...overrides,
  };
}
