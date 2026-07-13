import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SwipeableTabs,
  SwipeableTabsContent,
  SwipeableTabsList,
  SwipeableTabsTrigger,
  SwipeableTabsViewport,
} from "@/components/swipeable-tabs";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";

let intersectionObserverRoots: (Document | Element | null)[] = [];

beforeEach(() => {
  intersectionObserverRoots = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
    }
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        intersectionObserverRoots.push(options?.root ?? null);
      }

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

  it("uses independent panel scrolling by default without changing the document scroll", () => {
    render(
      <SwipeableTabs defaultValue="for-you">
        <SwipeableTabsList aria-label="Home feed sections">
          <SwipeableTabsTrigger value="for-you">For You</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="following">Following</SwipeableTabsTrigger>
        </SwipeableTabsList>
        <SwipeableTabsViewport>
          <SwipeableTabsContent value="for-you">For You panel</SwipeableTabsContent>
          <SwipeableTabsContent value="following">Following panel</SwipeableTabsContent>
        </SwipeableTabsViewport>
      </SwipeableTabs>
    );

    const viewport = document.querySelector<HTMLElement>("[data-swipeable-tabs-viewport]");
    const forYouPanel = document.querySelector<HTMLElement>('[data-value="for-you"][role="tabpanel"]');
    const followingPanel = document.querySelector<HTMLElement>('[data-value="following"][role="tabpanel"]');
    expect(viewport).not.toBeNull();
    expect(forYouPanel).not.toBeNull();
    expect(followingPanel).not.toBeNull();
    if (!(viewport && forYouPanel && followingPanel)) return;

    const windowScrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: windowScrollTo });
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(viewport, "scrollTo", { configurable: true, value: vi.fn() });

    expect(viewport.style.height).toBe("");
    expect(viewport.classList.contains("flex-1")).toBe(true);
    expect(forYouPanel.hasAttribute("data-swipeable-tabs-scroll-panel")).toBe(true);
    expect(followingPanel.hasAttribute("data-swipeable-tabs-scroll-panel")).toBe(true);
    expect(forYouPanel.classList.contains("overflow-y-auto")).toBe(true);
    expect(followingPanel.classList.contains("overflow-y-auto")).toBe(true);
    expect(forYouPanel.hasAttribute("inert")).toBe(false);
    expect(followingPanel.hasAttribute("inert")).toBe(true);

    forYouPanel.scrollTop = 900;
    fireEvent.click(screen.getByRole("tab", { name: "Following" }));
    Object.defineProperty(viewport, "scrollLeft", { configurable: true, value: 320 });
    fireEvent(viewport, new Event("scrollend"));
    expect(forYouPanel.hasAttribute("inert")).toBe(true);
    expect(followingPanel.hasAttribute("inert")).toBe(false);
    followingPanel.scrollTop = 180;

    fireEvent.click(screen.getByRole("tab", { name: "For You" }));
    Object.defineProperty(viewport, "scrollLeft", { configurable: true, value: 0 });
    fireEvent(viewport, new Event("scrollend"));

    expect(forYouPanel.hasAttribute("inert")).toBe(false);
    expect(followingPanel.hasAttribute("inert")).toBe(true);
    expect(forYouPanel.scrollTop).toBe(900);
    expect(followingPanel.scrollTop).toBe(180);
    expect(windowScrollTo).not.toHaveBeenCalled();
  });

  it("provides its panel as the automatic infinite-scroll root", () => {
    render(
      <SwipeableTabs defaultValue="reviews">
        <SwipeableTabsList aria-label="Profile sections">
          <SwipeableTabsTrigger value="reviews">Reviews</SwipeableTabsTrigger>
        </SwipeableTabsList>
        <SwipeableTabsViewport>
          <SwipeableTabsContent value="reviews">
            <LoadMoreProbe />
          </SwipeableTabsContent>
        </SwipeableTabsViewport>
      </SwipeableTabs>
    );

    const reviewsPanel = document.querySelector<HTMLElement>('[data-value="reviews"][role="tabpanel"]');
    expect(reviewsPanel).not.toBeNull();
    expect(intersectionObserverRoots).toContain(reviewsPanel);
  });

  it("activates a swiped tab only after horizontal scrolling settles", () => {
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
    if (!viewport) return;

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(viewport, "scrollLeft", { configurable: true, value: 240 });

    fireEvent.scroll(viewport);

    expect(screen.getByRole("tab", { name: "Reviews" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Likes" }).getAttribute("aria-selected")).toBe("false");

    Object.defineProperty(viewport, "scrollLeft", { configurable: true, value: 320 });
    fireEvent(viewport, new Event("scrollend"));

    expect(screen.getByRole("tab", { name: "Reviews" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "Likes" }).getAttribute("aria-selected")).toBe("true");
  });
});

function LoadMoreProbe() {
  const loadMoreRef = useLoadMoreOnIntersect({ enabled: true, isLoading: false, onLoadMore: vi.fn() });

  return <div ref={loadMoreRef} />;
}
