import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteSpotifyCacheJson } from "@/server/spotify-cache";
import { clearSpotifyRecentRotationCacheForDeletedAccount } from "@/server/spotify-recent-rotation-cache";

vi.mock("@/server/spotify-cache", () => ({
  deleteSpotifyCacheJson: vi.fn(),
}));

const mockDeleteSpotifyCacheJson = vi.mocked(deleteSpotifyCacheJson);

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteSpotifyCacheJson.mockResolvedValue(undefined);
});

describe("Spotify recent rotation cache", () => {
  it("clears the user's rotation when a Spotify account is deleted", async () => {
    await clearSpotifyRecentRotationCacheForDeletedAccount({
      providerId: "spotify",
      userId: "user_1",
    });

    expect(mockDeleteSpotifyCacheJson).toHaveBeenCalledWith("spotify:recent-rotation:user_1");
  });

  it("does not clear the rotation when another provider is deleted", async () => {
    await clearSpotifyRecentRotationCacheForDeletedAccount({
      providerId: "google",
      userId: "user_1",
    });

    expect(mockDeleteSpotifyCacheJson).not.toHaveBeenCalled();
  });
});
