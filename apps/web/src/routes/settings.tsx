import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/page-container";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { SessionsSection } from "@/components/settings/sessions-section";
import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsSkeleton } from "@/components/settings/settings-skeleton";
import { SignInMethodsTable } from "@/components/settings/sign-in-methods-table";
import { authClient } from "@/lib/auth/auth-client";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";
import { authProviders } from "@/lib/auth/providers";
import { accountQueryKeys, spotifyQueryKeys } from "@/lib/tanstack-query/query-keys";
import type { LinkedAccount } from "@/components/settings/sign-in-methods-table";
import type { AuthProviderId } from "@/lib/auth/providers";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Account Settings | Ratio" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function SettingsPage() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const [pendingProvider, setPendingProvider] = useState<AuthProviderId | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<AuthProviderId | null>(null);
  const [isRevokingOtherSessions, setIsRevokingOtherSessions] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const accountsQuery = useQuery({
    enabled: Boolean(session.data?.user),
    queryFn: listLinkedAccounts,
    queryKey: accountQueryKeys.providers(),
  });

  const deletionHandle = session.data?.user.username ?? session.data?.user.displayUsername ?? session.data?.user.name;
  const linkedAccounts = accountsQuery.data ?? [];
  const linkedProviderIds = new Set(linkedAccounts.map((account) => account.providerId));
  const linkedProviderCount = authProviders.filter((provider) => linkedProviderIds.has(provider.id)).length;

  useEffect(() => {
    if (!(session.isPending || session.data?.user)) {
      navigate({ replace: true, to: "/" });
    }
  }, [navigate, session.data?.user, session.isPending]);

  async function handleLinkProvider(providerId: AuthProviderId) {
    setPendingProvider(providerId);

    const returnUrl = getSettingsReturnUrl();
    const { data, error } = await authClient.linkSocial({
      callbackURL: returnUrl,
      errorCallbackURL: returnUrl,
      provider: providerId,
    });

    if (error) {
      toast.error("Couldn't link provider", {
        description: error.message ? getAuthErrorMessage(error.message) : "Something went wrong. Try again.",
      });

      return setPendingProvider(null);
    }

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    setPendingProvider(null);
  }

  async function handleUnlinkProvider(providerId: AuthProviderId, accountId?: string) {
    if (linkedProviderCount <= 1) {
      return toast.error("Keep one sign-in method", {
        description: "Link another provider before removing this one.",
      });
    }

    setUnlinkingProvider(providerId);
    const { error } = await authClient.unlinkAccount({
      accountId,
      providerId,
    });

    if (error) {
      toast.error("Couldn't unlink provider", {
        description: error.message ? getAuthErrorMessage(error.message) : "Something went wrong. Try again.",
      });

      return setUnlinkingProvider(null);
    }

    const userId = session.data?.user.id;
    if (providerId === "spotify" && userId) {
      queryClient.removeQueries({ queryKey: spotifyQueryKeys.recentRotation(userId) });
    }

    await queryClient.invalidateQueries({ queryKey: accountQueryKeys.providers() });
    setUnlinkingProvider(null);
    toast.success("Sign-in method removed");
  }

  async function handleRevokeOtherSessions() {
    setIsRevokingOtherSessions(true);
    const { error } = await authClient.revokeOtherSessions({});

    if (error) {
      toast.error("Couldn't sign out sessions", {
        description: error.message ? getAuthErrorMessage(error.message) : "Something went wrong. Try again.",
      });

      return setIsRevokingOtherSessions(false);
    }

    setIsRevokingOtherSessions(false);
    toast.success("Other sessions signed out");
  }

  async function handleDeleteAccount(confirmation: string) {
    if (!deletionHandle || confirmation !== deletionHandle) {
      return toast.error("Confirmation does not match", {
        description: "Type your account handle exactly to delete your account.",
      });
    }

    setIsDeletingAccount(true);
    const { error } = await authClient.deleteUser({
      callbackURL: "/",
    });

    if (error) {
      toast.error("Couldn't delete account", {
        description: error.message ? getAuthErrorMessage(error.message) : "Something went wrong. Try again.",
      });

      return setIsDeletingAccount(false);
    }

    window.location.href = "/";
  }

  if (session.isPending || !session.data?.user || accountsQuery.isPending) {
    return <SettingsSkeleton />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PageContainer className="flex max-w-5xl flex-col gap-10">
        <SettingsHeader />
        <SignInMethodsTable
          linkedAccounts={linkedAccounts}
          linkedProviderCount={linkedProviderCount}
          onLink={handleLinkProvider}
          onUnlink={handleUnlinkProvider}
          pendingProvider={pendingProvider}
          unlinkingProvider={unlinkingProvider}
        />
        <SessionsSection isPending={isRevokingOtherSessions} onSignOutOthers={handleRevokeOtherSessions} />
        <DeleteAccountSection
          confirmationHandle={deletionHandle}
          isPending={isDeletingAccount}
          onDeleteAccount={handleDeleteAccount}
        />
      </PageContainer>
    </main>
  );
}

async function listLinkedAccounts() {
  const { data, error } = await authClient.listAccounts();

  if (error) {
    throw new Error(error.message ? getAuthErrorMessage(error.message) : "Could not load sign-in methods.");
  }

  return (data ?? []) satisfies LinkedAccount[];
}

function getSettingsReturnUrl() {
  if (typeof window === "undefined") return "/settings";

  const url = new URL(window.location.href);
  url.searchParams.delete("error");

  return `${url.pathname}${url.search}${url.hash}`;
}
