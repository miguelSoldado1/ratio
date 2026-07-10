import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewShareButton } from "@/components/review-share-button";

const mockToastError = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

beforeEach(() => {
  mockToastError.mockReset();
  mockToastSuccess.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL("https://ratio.test/current"),
  });
});

describe("ReviewShareButton", () => {
  it("uses native share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(share);

    renderShareButton();
    fireEvent.click(screen.getByRole("button", { name: "Share review" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith({ text: expect.stringContaining("Alice reviewed Album") }));
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("falls back to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(undefined);
    setClipboard(writeText);

    renderShareButton();
    fireEvent.click(screen.getByRole("button", { name: "Share review" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("https://ratio.test/album/album_1/r/code_1"))
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("Review copied", { description: "The review is on your clipboard." });
  });

  it("handles native share cancellation without error toast", async () => {
    setNavigatorShare(vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")));

    renderShareButton();
    fireEvent.click(screen.getByRole("button", { name: "Share review" }));

    await waitFor(() => expect(mockToastError).not.toHaveBeenCalled());
  });

  it("clips long review text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(undefined);
    setClipboard(writeText);

    renderShareButton({ reviewBody: `${"word ".repeat(80)}final` });
    fireEvent.click(screen.getByRole("button", { name: "Share review" }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const sharedText = writeText.mock.calls[0]?.[0] as string;

    expect(sharedText).toContain("...");
    expect(sharedText.length).toBeLessThanOrEqual(280);
  });
});

function renderShareButton(overrides: Partial<Parameters<typeof ReviewShareButton>[0]> = {}) {
  return render(
    <ReviewShareButton
      album={{ artist: "Artist", id: "album_1", title: "Album" }}
      rating={4.5}
      reviewBody="A sharp review."
      reviewCode="code_1"
      userDisplayName="Alice"
      {...overrides}
    />
  );
}

function setNavigatorShare(share: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
}

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}
