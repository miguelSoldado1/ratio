import { renderWithQueryClient } from "@test/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { spotifyQueryKeys } from "@/lib/tanstack-query/query-keys";
import { Route } from "@/routes/settings";

const mockListAccounts = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockUnlinkAccount = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    listAccounts: mockListAccounts,
    unlinkAccount: mockUnlinkAccount,
    useSession: () => ({
      data: {
        user: {
          displayUsername: "Ratio User",
          id: "user_1",
          name: "Ratio User",
          username: "ratio_user",
        },
      },
      isPending: false,
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const linkedAccounts = [
  {
    accountId: "spotify-account",
    createdAt: "2026-07-01T00:00:00.000Z",
    id: "linked_spotify",
    providerId: "spotify",
    updatedAt: "2026-07-01T00:00:00.000Z",
    userId: "user_1",
  },
  {
    accountId: "google-account",
    createdAt: "2026-07-01T00:00:00.000Z",
    id: "linked_google",
    providerId: "google",
    updatedAt: "2026-07-01T00:00:00.000Z",
    userId: "user_1",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListAccounts.mockResolvedValue({ data: linkedAccounts, error: null });
  mockUnlinkAccount.mockResolvedValue({ data: { status: true }, error: null });
});

describe("SettingsPage", () => {
  it("removes the local recent rotation query after Spotify is unlinked", async () => {
    const SettingsPage = Route.options.component;
    if (!SettingsPage) throw new Error("Settings route component is missing");

    const { queryClient } = renderWithQueryClient(<SettingsPage />);
    const removeQueriesSpy = vi.spyOn(queryClient, "removeQueries");
    const spotifyRow = (await screen.findByText("Spotify")).closest("tr") as HTMLElement;

    fireEvent.click(within(spotifyRow).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(mockUnlinkAccount).toHaveBeenCalledWith({
        accountId: "spotify-account",
        providerId: "spotify",
      });
    });
    expect(removeQueriesSpy).toHaveBeenCalledWith({
      queryKey: spotifyQueryKeys.recentRotation("user_1"),
    });
  });
});
