import { useEffect, useRef } from "react";
import type { RefObject } from "react";

interface UseLoadMoreOnIntersectParams {
  enabled: boolean;
  isLoading: boolean;
  onLoadMore: () => Promise<unknown> | unknown;
  rootMargin?: string;
  rootRef?: RefObject<Element | null>;
}

export function useLoadMoreOnIntersect({
  enabled,
  isLoading,
  onLoadMore,
  rootMargin = "320px 0px",
  rootRef,
}: UseLoadMoreOnIntersectParams) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      loadMoreInFlightRef.current = false;
    }

    if (!(enabled && loadMoreRef.current && typeof IntersectionObserver !== "undefined")) return;

    const loadMoreElement = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !(isLoading || loadMoreInFlightRef.current)) {
          loadMoreInFlightRef.current = true;
          Promise.resolve(onLoadMore())
            .catch(() => undefined)
            .finally(() => {
              loadMoreInFlightRef.current = false;
            });
        }
      },
      { root: rootRef?.current ?? null, rootMargin }
    );

    observer.observe(loadMoreElement);

    return () => observer.disconnect();
  }, [enabled, isLoading, onLoadMore, rootMargin, rootRef]);

  return loadMoreRef;
}
