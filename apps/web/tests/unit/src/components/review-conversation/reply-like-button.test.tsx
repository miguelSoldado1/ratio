import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplyLikeButton } from "@/components/review-conversation/reply-like-button";

afterEach(() => {
  vi.useRealTimers();
});

describe("ReplyLikeButton", () => {
  it("updates immediately and persists the final state after the debounce", async () => {
    vi.useFakeTimers();
    const onToggle = vi.fn().mockResolvedValue(undefined);
    renderReplyLikeButton({ onToggle });

    fireEvent.click(screen.getByRole("button", { name: "Like reply by Alice" }));

    const optimisticButton = screen.getByRole("button", { name: "Unlike reply by Alice" });
    expect(optimisticButton.getAttribute("aria-pressed")).toBe("true");
    expect(optimisticButton.hasAttribute("disabled")).toBe(false);
    expect(onToggle).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("coalesces a rapid like and unlike without a request", async () => {
    vi.useFakeTimers();
    const onToggle = vi.fn().mockResolvedValue(undefined);
    renderReplyLikeButton({ onToggle });

    fireEvent.click(screen.getByRole("button", { name: "Like reply by Alice" }));
    fireEvent.click(screen.getByRole("button", { name: "Unlike reply by Alice" }));

    expect(screen.getByRole("button", { name: "Like reply by Alice" })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("rolls the optimistic state back when persistence fails", async () => {
    vi.useFakeTimers();
    const onToggle = vi.fn().mockResolvedValue(false);
    renderReplyLikeButton({ onToggle });

    fireEvent.click(screen.getByRole("button", { name: "Like reply by Alice" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    const restoredButton = screen.getByRole("button", { name: "Like reply by Alice" });
    expect(restoredButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("opens the liker list from the count without toggling the heart", () => {
    const onShowLikes = vi.fn();
    const onToggle = vi.fn();
    renderReplyLikeButton({ onShowLikes, onToggle });

    fireEvent.click(screen.getByRole("button", { name: "Show people who liked this reply by Alice, 2 likes" }));

    expect(onShowLikes).toHaveBeenCalledOnce();
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Like reply by Alice" }).getAttribute("aria-pressed")).toBe("false");
  });
});

function renderReplyLikeButton(overrides: Partial<React.ComponentProps<typeof ReplyLikeButton>> = {}) {
  return render(
    <ReplyLikeButton authorName="Alice" disabled={false} liked={false} likes={2} onToggle={vi.fn()} {...overrides} />
  );
}
