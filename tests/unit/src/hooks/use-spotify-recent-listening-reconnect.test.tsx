import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@test/react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSpotifyRecentListeningReconnect } from "@/hooks/use-spotify-recent-listening-reconnect";
import { spotifyQueryKeys } from "@/lib/tanstack-query/query-keys";
import type { ReactNode } from "react";

const mockLinkSocial = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    linkSocial: mockLinkSocial,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

beforeEach(() => {
  mockLinkSocial.mockReset();
  mockToastError.mockReset();
});

describe("useSpotifyRecentListeningReconnect", () => {
  it("requests the scope and refreshes the recent rotation query", async () => {
    mockLinkSocial.mockResolvedValue({ data: {}, error: null });
    const { queryClient, result } = renderHookWithQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.requestReconnect();
    });

    expect(mockLinkSocial).toHaveBeenCalledWith({
      callbackURL: "/",
      errorCallbackURL: "/",
      provider: "spotify",
      scopes: ["user-read-recently-played"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: spotifyQueryKeys.recentRotation("user_1") });
    expect(result.current.isPending).toBe(false);
  });

  it("shows an error toast and stops without invalidating when linking fails", async () => {
    mockLinkSocial.mockResolvedValue({ data: null, error: { message: "PROVIDER_ERROR" } });
    const { queryClient, result } = renderHookWithQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      await result.current.requestReconnect();
    });

    expect(mockToastError).toHaveBeenCalledWith("Couldn't reconnect Spotify", expect.anything());
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it("redirects to the provider authorization URL when one is returned", async () => {
    mockLinkSocial.mockResolvedValue({ data: { url: "https://accounts.spotify.com/authorize" }, error: null });
    const hrefSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSpy(value);
        },
      },
    });
    const { queryClient, result } = renderHookWithQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    try {
      await act(async () => {
        await result.current.requestReconnect();
      });
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }

    expect(hrefSpy).toHaveBeenCalledWith("https://accounts.spotify.com/authorize");
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });
});

function renderHookWithQueryClient() {
  const queryClient = createTestQueryClient();
  const rendered = renderHook(() => useSpotifyRecentListeningReconnect("user_1"), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return { queryClient, ...rendered };
}
