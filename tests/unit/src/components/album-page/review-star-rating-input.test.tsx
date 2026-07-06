import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewStarRatingInput } from "@/components/album-page/review-star-rating-input";

describe("ReviewStarRatingInput", () => {
  it.each([
    ["ArrowRight", 2.5, 3],
    ["ArrowUp", 2.5, 3],
    ["ArrowLeft", 2.5, 2],
    ["ArrowDown", 2.5, 2],
    ["PageUp", 2.5, 3.5],
    ["PageDown", 2.5, 1.5],
    ["Home", 2.5, 0],
    ["End", 2.5, 5],
    ["Delete", 2.5, 0],
    ["Backspace", 2.5, 0],
  ])("handles %s keyboard input", (key, value, expectedValue) => {
    const onChange = vi.fn();

    render(<ReviewStarRatingInput onChange={onChange} value={value} />);

    fireEvent.keyDown(screen.getByRole("slider"), { key });

    expect(onChange).toHaveBeenCalledWith(expectedValue);
  });

  it("does not move outside the allowed rating range", () => {
    const onChange = vi.fn();

    const { rerender } = render(<ReviewStarRatingInput onChange={onChange} value={5} />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(5);

    rerender(<ReviewStarRatingInput onChange={onChange} value={0} />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("exposes ARIA value text for the current rating", () => {
    const { rerender } = render(<ReviewStarRatingInput onChange={vi.fn()} value={0} />);

    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("No rating");

    rerender(<ReviewStarRatingInput onChange={vi.fn()} value={1} />);
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("1 star out of 5");

    rerender(<ReviewStarRatingInput onChange={vi.fn()} value={3.5} />);
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("3.5 stars out of 5");
  });

  it("uses pointer position to select half-star steps", () => {
    const onChange = vi.fn();

    render(<ReviewStarRatingInput onChange={onChange} value={0} />);
    const slider = screen.getByRole("slider");
    const track = slider.querySelector("[data-slot='review-star-track']");

    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 0, height: 20, left: 100, right: 200, top: 0, width: 100, x: 100, y: 0 }),
    });
    Object.assign(slider, {
      hasPointerCapture: () => false,
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    fireEvent.pointerDown(slider, { clientX: 111, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith(1);
  });
});
