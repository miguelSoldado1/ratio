import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "@/components/auth/auth-dialog";

const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    getLastUsedLoginMethod: vi.fn(() => null),
    signIn: { social: vi.fn() },
    useSession: mockUseSession,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthDialog", () => {
  it("opens for a signed-out user once the session has resolved", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthDialog onOpenChange={vi.fn()} open />);

    expect(screen.getByRole("dialog", { name: "Continue to Ratio" })).toBeTruthy();
  });

  it("stays closed while the session is pending", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true });

    render(<AuthDialog onOpenChange={vi.fn()} open />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays closed and clears the requested open state for a signed-in user", async () => {
    const onOpenChange = vi.fn();
    mockUseSession.mockReturnValue({
      data: { user: { id: "user_1" } },
      isPending: false,
    });

    render(<AuthDialog onOpenChange={onOpenChange} open />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
