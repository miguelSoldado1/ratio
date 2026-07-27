import { describe, expect, it, vi } from "vitest";
import { createListAlbumAddQueue } from "@/components/list/list-album-add-queue";

describe("createListAlbumAddQueue", () => {
  it("runs rapid selections in FIFO order", async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const queue = createListAlbumAddQueue();
    const starts: string[] = [];

    const firstResult = queue.enqueue(async () => {
      starts.push("first");
      return await first.promise;
    });
    const secondResult = queue.enqueue(async () => {
      starts.push("second");
      return await second.promise;
    });

    await vi.waitFor(() => expect(starts).toEqual(["first"]));
    first.resolve("first result");
    await expect(firstResult).resolves.toBe("first result");
    await vi.waitFor(() => expect(starts).toEqual(["first", "second"]));
    second.resolve("second result");
    await expect(secondResult).resolves.toBe("second result");
  });

  it("continues with the next selection after a failure", async () => {
    const queue = createListAlbumAddQueue();
    const starts: string[] = [];

    const failedResult = queue.enqueue(() => {
      starts.push("failed");
      return Promise.reject(new Error("Could not add album"));
    });
    const nextResult = queue.enqueue(() => {
      starts.push("next");
      return Promise.resolve("added");
    });

    await expect(failedResult).rejects.toThrow("Could not add album");
    await expect(nextResult).resolves.toBe("added");
    expect(starts).toEqual(["failed", "next"]);
  });
});

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}
