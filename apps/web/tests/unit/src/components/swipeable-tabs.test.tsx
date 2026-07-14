import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SwipeableTabs,
  SwipeableTabsContent,
  SwipeableTabsHeader,
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
    expect(forYouPanel.classList.contains("[scrollbar-width:none]")).toBe(true);
    expect(forYouPanel.classList.contains("[&::-webkit-scrollbar]:hidden")).toBe(true);
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

  it("lets the tab list and swipe viewport span the full viewport", () => {
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

    const root = document.querySelector<HTMLElement>("[data-swipeable-tabs-root]");
    const list = document.querySelector<HTMLElement>("[data-swipeable-tabs-list]");
    const controls = document.querySelector<HTMLElement>("[data-swipeable-tabs-controls]");
    const viewport = document.querySelector<HTMLElement>("[data-swipeable-tabs-viewport]");
    expect(root).not.toBeNull();
    expect(list).not.toBeNull();
    expect(controls).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(root?.classList.contains("overflow-hidden")).toBe(false);
    expect(list?.classList.contains("left-[calc(50%-50vw)]")).toBe(true);
    expect(list?.classList.contains("w-screen")).toBe(true);
    expect(controls?.classList.contains("w-full")).toBe(true);
    expect(controls?.classList.contains("lg:w-fit")).toBe(true);
    expect(screen.getByRole("tab", { name: "Reviews" }).classList.contains("lg:min-w-36")).toBe(true);
    expect(viewport?.classList.contains("left-[calc(50%-50vw)]")).toBe(true);
    expect(viewport?.classList.contains("w-screen")).toBe(true);
  });

  it("keeps vertical touch gestures native and captures horizontal swipes", () => {
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
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: 640 });
    Object.defineProperty(viewport, "scrollLeft", { configurable: true, value: 0, writable: true });
    const scrollTo = vi.fn();
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperties(viewport, {
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
      scrollTo: { configurable: true, value: scrollTo },
      setPointerCapture: { configurable: true, value: setPointerCapture },
    });

    fireEvent.pointerDown(viewport, {
      clientX: 240,
      clientY: 100,
      isPrimary: true,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(viewport, { clientX: 235, clientY: 150, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(viewport, { clientX: 235, clientY: 150, pointerId: 1, pointerType: "touch" });

    expect(viewport.scrollLeft).toBe(0);
    expect(setPointerCapture).not.toHaveBeenCalled();

    fireEvent.pointerDown(viewport, {
      clientX: 240,
      clientY: 100,
      isPrimary: true,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerMove(viewport, { clientX: 140, clientY: 105, pointerId: 2, pointerType: "touch" });

    expect(setPointerCapture).toHaveBeenCalledWith(2);
    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.style.scrollSnapType).toBe("none");

    fireEvent.pointerUp(viewport, { clientX: 140, clientY: 105, pointerId: 2, pointerType: "touch" });

    expect(releasePointerCapture).toHaveBeenCalledWith(2);
    expect(viewport.style.scrollSnapType).toBe("");
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "smooth", left: 320 });
  });

  it("scrolls a shared header away while keeping the tab list at the top", () => {
    const offsetHeight = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.hasAttribute("data-swipeable-tabs-header")) return 200;
      if (this.hasAttribute("data-swipeable-tabs-list")) return 48;
      return 0;
    });

    render(
      <SwipeableTabs defaultValue="reviews">
        <SwipeableTabsHeader>Profile header</SwipeableTabsHeader>
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

    const header = document.querySelector<HTMLElement>("[data-swipeable-tabs-header]");
    const list = document.querySelector<HTMLElement>("[data-swipeable-tabs-list]");
    const viewport = document.querySelector<HTMLElement>("[data-swipeable-tabs-viewport]");
    const reviewsPanel = document.querySelector<HTMLElement>('[data-value="reviews"][role="tabpanel"]');
    const likesPanel = document.querySelector<HTMLElement>('[data-value="likes"][role="tabpanel"]');
    const likesContent = likesPanel?.querySelector<HTMLElement>("[data-swipeable-tabs-content-inner]");
    expect(header).not.toBeNull();
    expect(list).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(reviewsPanel).not.toBeNull();
    expect(likesPanel).not.toBeNull();
    expect(likesContent).not.toBeNull();
    if (!(header && list && viewport && reviewsPanel && likesPanel && likesContent)) return;

    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(viewport, "scrollTo", { configurable: true, value: vi.fn() });

    expect(reviewsPanel.style.paddingTop).toBe("247px");
    expect(likesContent.style.minHeight).toBe("calc(100% + 200px)");

    reviewsPanel.scrollTop = 120;
    fireEvent.scroll(reviewsPanel);
    expect(header.style.transform).toBe("translate3d(0, -120px, 0)");
    expect(list.style.transform).toBe("translate3d(0, -120px, 0)");

    reviewsPanel.scrollTop = 300;
    fireEvent.scroll(reviewsPanel);
    expect(header.style.transform).toBe("translate3d(0, -200px, 0)");
    expect(list.style.transform).toBe("translate3d(0, -200px, 0)");

    fireEvent.click(screen.getByRole("tab", { name: "Likes" }));
    expect(likesPanel.scrollTop).toBe(200);
    expect(header.style.transform).toBe("translate3d(0, -200px, 0)");
    expect(list.style.transform).toBe("translate3d(0, -200px, 0)");

    likesPanel.scrollTop = 0;
    fireEvent.scroll(likesPanel);
    fireEvent.click(screen.getByRole("tab", { name: "Reviews" }));
    expect(reviewsPanel.scrollTop).toBe(0);
    expect(header.style.transform).toBe("translate3d(0, 0px, 0)");
    expect(list.style.transform).toBe("translate3d(0, 0px, 0)");

    offsetHeight.mockRestore();
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
