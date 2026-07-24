import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewPageShell } from "@/components/review-conversation/review-page-shell";

const album = {
  artist: "Radiohead",
  coverUrl: "https://images.example/cover.jpg",
  id: "album-1",
  title: "In Rainbows",
  year: "2007",
};

describe("ReviewPageShell", () => {
  it("provides a descriptive document heading without duplicating album navigation", () => {
    render(
      <ReviewPageShell album={album}>
        <p>Reading column</p>
      </ReviewPageShell>
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Review");
    expect(heading.textContent).toContain("In Rainbows");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Reading column")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the page geometry with skeleton placeholders while pending", () => {
    render(
      <ReviewPageShell pending>
        <p>Loading column</p>
      </ReviewPageShell>
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Review");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Loading column")).toBeTruthy();
  });

  it("keeps a generic document heading when the album is unknown", () => {
    render(
      <ReviewPageShell>
        <p>Unavailable column</p>
      </ReviewPageShell>
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Review");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Unavailable column")).toBeTruthy();
  });
});
