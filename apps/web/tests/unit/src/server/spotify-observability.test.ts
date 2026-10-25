import { afterEach, describe, expect, it, vi } from "vitest";
import { logSpotifyApiError } from "@/server/spotify-observability";

afterEach(() => vi.restoreAllMocks());

describe("logSpotifyApiError", () => {
  it("logs the response body when the Spotify client stringified it to [object Object]", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("[object Object]"), { body: { error: "unavailable" }, statusCode: 503 });

    logSpotifyApiError("album_lookup", error);

    expect(consoleError).toHaveBeenCalledWith(
      "spotify_api_error",
      expect.objectContaining({ errorMessage: '{"error":"unavailable"}', status: 503 })
    );
  });

  it("keeps the original message when the body cannot be serialized", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const body: { self?: unknown } = {};
    body.self = body;

    logSpotifyApiError("album_lookup", Object.assign(new Error("[object Object]"), { body }));

    expect(consoleError).toHaveBeenCalledWith(
      "spotify_api_error",
      expect.objectContaining({ errorMessage: "[object Object]" })
    );
  });
});
