import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SwipeableTabs,
  SwipeableTabsContent,
  SwipeableTabsList,
  SwipeableTabsTrigger,
  SwipeableTabsViewport,
} from "@/components/swipeable-tabs";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
    }
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

describe("SwipeableTabs", () => {
  it("selects and scrolls to a clicked tab", () => {
    render(
      <SwipeableTabs defaultValue="reviews">
        <SwipeableTabsList aria-label="Profile sections">
          <SwipeableTabsTrigger value="reviews">Reviews</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="likes">Likes</SwipeableTabsTrigger>
        </SwipeableTabsList>
        <SwipeableTabsViewport>
          <SwipeableTabsContent value="reviews">Reviews panel</SwipeableTabsContent>
          <SwipeableTabsContent value="likes">Likes panel</SwipeableTabsContent>
        </SwipeableTabsViewport>
      </SwipeableTabs>
    );

    const viewport = document.querySelector<HTMLElement>("[data-swipeable-tabs-viewport]");
    expect(viewport).not.toBeNull();

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 320 });
    const scrollTo = vi.fn();
    Object.defineProperty(viewport, "scrollTo", { configurable: true, value: scrollTo });

    fireEvent.click(screen.getByRole("tab", { name: "Likes" }));

    expect(screen.getByRole("tab", { name: "Likes" }).getAttribute("aria-selected")).toBe("true");
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", left: 320 });
  });
});
