import { useEffect, useRef } from "react";

interface UseLoadMoreOnIntersectParams {
  enabled: boolean;
  isLoading: boolean;
  onLoadMore: () => Promise<unknown> | unknown;
  rootMargin?: string;
}

export function useLoadMoreOnIntersect({
  enabled,
  isLoading,
  onLoadMore,
  rootMargin = "320px 0px",
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
      { rootMargin }
    );

    observer.observe(loadMoreElement);

    return () => observer.disconnect();
  }, [enabled, isLoading, onLoadMore, rootMargin]);

  return loadMoreRef;
}
