import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type LinkedAccount, SignInMethodsTable } from "@/components/settings/sign-in-methods-table";

const linkedSpotify = {
  accountId: "spotify-account",
  createdAt: "2026-07-01T00:00:00.000Z",
  id: "linked_spotify",
  providerId: "spotify",
  updatedAt: "2026-07-01T00:00:00.000Z",
  userId: "user_1",
} satisfies LinkedAccount;

const linkedGoogle = {
  ...linkedSpotify,
  accountId: "google-account",
  id: "linked_google",
  providerId: "google",
} satisfies LinkedAccount;

describe("SignInMethodsTable", () => {
  it("prevents removing the last linked provider", () => {
    renderTable({ linkedAccounts: [linkedSpotify], linkedProviderCount: 1 });

    const spotifyRow = screen.getByText("Spotify").closest("tr");

    expect(
      (within(spotifyRow as HTMLElement).getByRole("button", { name: "Remove" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("calls link and unlink handlers", () => {
    const onLink = vi.fn();
    const onUnlink = vi.fn();
    renderTable({ linkedAccounts: [linkedSpotify, linkedGoogle], linkedProviderCount: 2, onLink, onUnlink });

    fireEvent.click(
      within(screen.getByText("Discord").closest("tr") as HTMLElement).getByRole("button", { name: "Link" })
    );
    expect(onLink).toHaveBeenCalledWith("discord");

    fireEvent.click(
      within(screen.getByText("Spotify").closest("tr") as HTMLElement).getByRole("button", { name: "Remove" })
    );
    expect(onUnlink).toHaveBeenCalledWith("spotify", "spotify-account");
  });

  it("renders provider status", () => {
    renderTable({ linkedAccounts: [linkedSpotify], linkedProviderCount: 1 });

    expect((screen.getByText("Spotify").closest("tr") as HTMLElement).textContent).toContain("Connected");
    expect((screen.getByText("Google").closest("tr") as HTMLElement).textContent).toContain("Available");
  });
});

function renderTable({
  linkedAccounts,
  linkedProviderCount,
  onLink = vi.fn(),
  onUnlink = vi.fn(),
}: {
  linkedAccounts: LinkedAccount[];
  linkedProviderCount: number;
  onLink?: (providerId: "spotify" | "google" | "discord") => void;
  onUnlink?: (providerId: "spotify" | "google" | "discord", accountId?: string) => void;
}) {
  return render(
    <SignInMethodsTable
      linkedAccounts={linkedAccounts}
      linkedProviderCount={linkedProviderCount}
      onLink={onLink}
      onUnlink={onUnlink}
      pendingProvider={null}
      unlinkingProvider={null}
    />
  );
}
