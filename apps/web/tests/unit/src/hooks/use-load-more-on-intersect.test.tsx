import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";

let observerCallback: IntersectionObserverCallback | undefined;
let observerOptions: IntersectionObserverInit | undefined;

beforeEach(() => {
  observerCallback = undefined;
  observerOptions = undefined;

  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observerCallback = callback;
        observerOptions = options;
      }

      disconnect = vi.fn();
      observe = vi.fn();
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLoadMoreOnIntersect", () => {
  it("uses the nearest infinite-scroll root and loads when the sentinel intersects", () => {
    const onLoadMore = vi.fn();
    render(
      <div data-infinite-scroll-root data-testid="scroll-root">
        <LoadMoreProbe onLoadMore={onLoadMore} />
      </div>
    );

    expect(observerOptions?.root).toBe(screen.getByTestId("scroll-root"));

    observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});

function LoadMoreProbe({ onLoadMore }: { onLoadMore: () => void }) {
  const loadMoreRef = useLoadMoreOnIntersect({ enabled: true, isLoading: false, onLoadMore });

  return <div ref={loadMoreRef} />;
}
