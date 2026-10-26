import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "@/components/auth/auth-dialog";

const mockUseSession = vi.hoisted(() => vi.fn());
const mockSignInSocial = vi.hoisted(() => vi.fn());
const mockAnalytics = vi.hoisted(() => ({
  trackAuthDialogOpened: vi.fn(),
  trackSignInFailed: vi.fn(),
  trackSignInStarted: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick, to }: { children: string; onClick?: () => void; to: string }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    signIn: { social: mockSignInSocial },
    useSession: mockUseSession,
  },
}));

vi.mock("@/lib/analytics/posthog", () => mockAnalytics);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthDialog", () => {
  it("opens for a signed-out user once the session has resolved", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthDialog onOpenChange={vi.fn()} open source="header" />);

    expect(screen.getByRole("dialog", { name: "Continue to Ratio" })).toBeTruthy();
    expect(screen.queryByText("Last used")).toBeNull();
    expect(screen.queryByText("Recommended")).toBeNull();
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
  });

  it("reports the opening source once it is visible", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });

    render(<AuthDialog onOpenChange={vi.fn()} open source="review_like" />);

    expect(mockAnalytics.trackAuthDialogOpened).toHaveBeenCalledTimes(1);
    expect(mockAnalytics.trackAuthDialogOpened).toHaveBeenCalledWith("review_like");
  });

  it("reports the chosen provider and a failed sign-in request", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });
    mockSignInSocial.mockResolvedValue({ error: { code: "provider_not_found", message: "Nope" } });

    render(<AuthDialog onOpenChange={vi.fn()} open source="follow" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(mockAnalytics.trackSignInStarted).toHaveBeenCalledWith("google", "follow");
    await waitFor(() => expect(mockAnalytics.trackSignInFailed).toHaveBeenCalledWith("provider_not_found"));
  });

  it("reports a rejected sign-in request and re-enables the providers", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });
    mockSignInSocial.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<AuthDialog onOpenChange={vi.fn()} open source="header" />);
    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    fireEvent.click(googleButton);

    await waitFor(() => expect(mockAnalytics.trackSignInFailed).toHaveBeenCalledWith("network_error"));
    expect(googleButton.hasAttribute("disabled")).toBe(false);
  });

  it("stays closed while the session is pending", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: true });

    render(<AuthDialog onOpenChange={vi.fn()} open source="header" />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockAnalytics.trackAuthDialogOpened).not.toHaveBeenCalled();
  });

  it("stays closed and clears the requested open state for a signed-in user", async () => {
    const onOpenChange = vi.fn();
    mockUseSession.mockReturnValue({
      data: { user: { id: "user_1" } },
      isPending: false,
    });

    render(<AuthDialog onOpenChange={onOpenChange} open source="header" />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
