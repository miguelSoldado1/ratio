import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@test/react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserFollowToggle } from "@/hooks/use-user-follow-toggle";
import type { ReactNode } from "react";
import type { UserProfile } from "@/server/services/review-service";

const mockServerFn = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn(() => mockServerFn),
}));

vi.mock("@/server/functions/follow-functions", () => ({
  setUserFollow: {},
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

beforeEach(() => {
  mockServerFn.mockReset();
  mockToastError.mockReset();
});

describe("useUserFollowToggle", () => {
  it("disabled state returns false", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useUserFollowToggle({ enabled: false, queryKey: ["profile"] }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.toggleUserFollow("user_1", true)).resolves.toBe(false);
    expect(mockServerFn).not.toHaveBeenCalled();
  });

  it("optimistically updates follower count and followed state", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ["profile"];
    let resolveMutation: (value: unknown) => void = () => undefined;
    queryClient.setQueryData(queryKey, createProfile({ followedByViewer: false, followersCount: 2 }));
    mockServerFn.mockReturnValue(
      new Promise((resolve) => {
        resolveMutation = resolve;
      })
    );
    const { result } = renderHook(() => useUserFollowToggle({ enabled: true, queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    const pending = result.current.toggleUserFollow("user_1", true);

    expect(queryClient.getQueryData<UserProfile>(queryKey)).toMatchObject({
      followersCount: 3,
      user: { followedByViewer: true },
    });

    resolveMutation({ followedByViewer: true, followersCount: 4, followingCount: 9, userId: "user_1" });
    await act(async () => {
      await pending;
    });
  });

  it("successful mutation reconciles server counts and invalidates profile query", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ["profile"];
    queryClient.setQueryData(
      queryKey,
      createProfile({ followedByViewer: false, followersCount: 2, followingCount: 5 })
    );
    mockServerFn.mockResolvedValue({ followedByViewer: true, followersCount: 8, followingCount: 6, userId: "user_1" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUserFollowToggle({ enabled: true, queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.toggleUserFollow("user_1", true)).resolves.toBe(true);

    expect(queryClient.getQueryData<UserProfile>(queryKey)).toMatchObject({
      followersCount: 8,
      followingCount: 6,
      user: { followedByViewer: true },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });

  it("failed mutation rolls back previous profile and shows toast", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = ["profile"];
    const profile = createProfile({ followedByViewer: false, followersCount: 2 });
    queryClient.setQueryData(queryKey, profile);
    mockServerFn.mockRejectedValue(new Error("Nope"));
    const { result } = renderHook(() => useUserFollowToggle({ enabled: true, queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.toggleUserFollow("user_1", true)).resolves.toBe(false);

    expect(queryClient.getQueryData(queryKey)).toEqual(profile);
    expect(mockToastError).toHaveBeenCalledWith("Couldn't update follow", { description: "Nope" });
  });
});

function createProfile({
  followedByViewer,
  followersCount,
  followingCount = 0,
}: {
  followedByViewer: boolean;
  followersCount: number;
  followingCount?: number;
}): UserProfile {
  return {
    followersCount,
    followingCount,
    reviewCount: 0,
    user: {
      avatarObjectKey: undefined,
      avatarUrl: undefined,
      banned: false,
      canEdit: false,
      displayName: "User One",
      displayUsername: "User One",
      followedByViewer,
      id: "user_1",
      username: "user_1",
    },
  };
}

function createWrapper(queryClient: ReturnType<typeof createTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
