import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteImageObjects,
  isListCoverObjectKey,
  isUserAvatarObjectKey,
  purgeImageCache,
} from "@/server/image-storage";

const mockDeleteObject = vi.hoisted(() => vi.fn());

vi.mock("@better-upload/server/helpers", () => ({
  deleteObject: mockDeleteObject,
}));

vi.mock("@better-upload/server/clients", () => ({
  cloudflare: vi.fn(() => ({ client: "r2" })),
}));

vi.mock("@/env", () => ({
  env: {
    CLOUDFLARE_ACCESS_KEY_ID: "access-key",
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_R2_BUCKET_NAME: "bucket",
    CLOUDFLARE_R2_PUBLIC_URL: "https://assets.example.com",
    CLOUDFLARE_CACHE_PURGE_API_TOKEN: "purge-token",
    CLOUDFLARE_SECRET_ACCESS_KEY: "secret",
    CLOUDFLARE_ZONE_ID: "zone-id",
  },
}));

const userId = "user_123";
const validObjectName = "123e4567-e89b-12d3-a456-426614174000.jpg";

describe("isUserAvatarObjectKey", () => {
  it("accepts valid avatar object keys for the requested user", () => {
    expect(isUserAvatarObjectKey(`avatars/${userId}/${validObjectName}`, userId)).toBe(true);
  });

  it("rejects keys outside the requested user's avatar prefix", () => {
    expect(isUserAvatarObjectKey(`avatars/other_user/${validObjectName}`, userId)).toBe(false);
    expect(isUserAvatarObjectKey(`avatars/${userId}-copy/${validObjectName}`, userId)).toBe(false);
  });

  it("rejects invalid object names under the user's avatar prefix", () => {
    expect(isUserAvatarObjectKey(`avatars/${userId}/not-a-uuid.jpg`, userId)).toBe(false);
    expect(isUserAvatarObjectKey(`avatars/${userId}/123e4567-e89b-12d3-a456-426614174000.gif`, userId)).toBe(false);
    expect(isUserAvatarObjectKey(`avatars/${userId}/${validObjectName}/extra`, userId)).toBe(false);
  });
});

describe("isListCoverObjectKey", () => {
  const listId = "0b6f3c1e-5d4a-4f8e-9c2b-7a1d3e5f6a7b";

  it("accepts valid cover object keys for the requested list", () => {
    expect(isListCoverObjectKey(`list-covers/${listId}/${validObjectName}`, listId)).toBe(true);
  });

  it("rejects keys for another list or another image kind", () => {
    expect(isListCoverObjectKey(`list-covers/other-list/${validObjectName}`, listId)).toBe(false);
    expect(isListCoverObjectKey(`avatars/${listId}/${validObjectName}`, listId)).toBe(false);
    expect(isListCoverObjectKey(`list-covers/${listId}/not-a-uuid.png`, listId)).toBe(false);
  });
});

describe("purgeImageCache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("purges the public URLs of the given objects", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    await purgeImageCache(["avatars/user_123/a.png", "list-covers/list_1/b.png"]);

    expect(mockFetch).toHaveBeenCalledWith("https://api.cloudflare.com/client/v4/zones/zone-id/purge_cache", {
      body: JSON.stringify({
        files: [
          "https://assets.example.com/avatars/user_123/a.png",
          "https://assets.example.com/list-covers/list_1/b.png",
        ],
      }),
      headers: { Authorization: "Bearer purge-token", "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("retries once after a rate limit", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { headers: { "Retry-After": "0" }, status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await purgeImageCache(["avatars/user_123/a.png"]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs a failed purge instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(purgeImageCache(["avatars/user_123/a.png"])).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "image_cache_purge_failed",
      expect.objectContaining({ objectKeys: ["avatars/user_123/a.png"] })
    );
  });
});

describe("deleteImageObjects", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockDeleteObject.mockReset();
  });

  it("purges every deleted image in one request and skips images that failed to delete", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    mockDeleteObject.mockImplementation((_client, { key }: { key: string }) =>
      key.includes("broken") ? Promise.reject(new Error("R2 down")) : Promise.resolve()
    );

    const results = await deleteImageObjects(["avatars/u/a.png", "list-covers/l/broken.png", "list-covers/l/c.png"]);

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(mockFetch.mock.calls[0][1].body))).toEqual({
      files: ["https://assets.example.com/avatars/u/a.png", "https://assets.example.com/list-covers/l/c.png"],
    });
  });
});
