import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedOptimisticLike } from "@/hooks/use-debounced-optimistic-like";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedOptimisticLike", () => {
  it("rolls a failed queued toggle back to the last successfully persisted state", async () => {
    vi.useFakeTimers();
    const likeRequest = createDeferred<boolean | undefined>();
    const unlikeRequest = createDeferred<boolean | undefined>();
    const onToggle = vi
      .fn<(liked: boolean) => Promise<boolean | undefined>>()
      .mockImplementationOnce(() => likeRequest.promise)
      .mockImplementationOnce(() => unlikeRequest.promise);
    const { result } = renderHook(() => useDebouncedOptimisticLike({ count: 0, liked: false, onToggle }));

    act(() => result.current.toggle());
    await act(() => vi.advanceTimersByTimeAsync(350));

    expect(onToggle).toHaveBeenNthCalledWith(1, true);

    act(() => result.current.toggle());
    await act(() => vi.advanceTimersByTimeAsync(350));

    expect(result.current).toMatchObject({ count: 0, liked: false });
    expect(onToggle).toHaveBeenCalledTimes(1);

    await act(async () => {
      likeRequest.resolve(undefined);
      await likeRequest.promise;
    });

    expect(onToggle).toHaveBeenNthCalledWith(2, false);

    await act(async () => {
      unlikeRequest.resolve(false);
      await unlikeRequest.promise;
    });

    expect(result.current).toMatchObject({ count: 1, liked: true });
  });

  it("reconciles to authoritative props received while persistence is in flight", async () => {
    vi.useFakeTimers();
    const likeRequest = createDeferred<boolean | undefined>();
    const onToggle = vi.fn(() => likeRequest.promise);
    const { rerender, result } = renderHook(
      ({ count, liked }) => useDebouncedOptimisticLike({ count, liked, onToggle }),
      { initialProps: { count: 2, liked: false } }
    );

    act(() => result.current.toggle());
    await act(() => vi.advanceTimersByTimeAsync(350));

    act(() => rerender({ count: 5, liked: true }));

    await act(async () => {
      likeRequest.resolve(undefined);
      await likeRequest.promise;
    });

    expect(result.current).toMatchObject({ count: 5, liked: true });
  });
});

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}
