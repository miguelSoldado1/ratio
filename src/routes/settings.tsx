import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { SessionsSection } from "@/components/settings/sessions-section";
import { SettingsHeader } from "@/components/settings/settings-header";
import { SignInMethodsTable } from "@/components/settings/sign-in-methods-table";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/auth-client";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";
import { authProviders } from "@/lib/auth/providers";
import { accountQueryKeys } from "@/lib/tanstack-query/query-keys";
import type { LinkedAccount } from "@/components/settings/sign-in-methods-table";
import type { AuthProviderId } from "@/lib/auth/providers";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

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
      toast.error("Provider link failed", {
        description: error.message ? getAuthErrorMessage(error.message) : "Could not link provider.",
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
      toast.error("Provider unlink failed", {
        description: error.message ? getAuthErrorMessage(error.message) : "Could not unlink provider.",
      });

      return setUnlinkingProvider(null);
    }

    await queryClient.invalidateQueries({ queryKey: accountQueryKeys.providers() });
    setUnlinkingProvider(null);
    toast.success("Success", { description: "Sign-in method removed" });
  }

  async function handleRevokeOtherSessions() {
    setIsRevokingOtherSessions(true);
    const { error } = await authClient.revokeOtherSessions({});

    if (error) {
      toast.error("Session sign-out failed", {
        description: error.message ? getAuthErrorMessage(error.message) : "Could not sign out other sessions.",
      });

      return setIsRevokingOtherSessions(false);
    }

    setIsRevokingOtherSessions(false);
    toast.success("Success", { description: "Other sessions signed out" });
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
      toast.error("Account deletion failed", {
        description: error.message ? getAuthErrorMessage(error.message) : "Could not delete account.",
      });

      return setIsDeletingAccount(false);
    }

    window.location.href = "/";
  }

  if (session.isPending || !session.data?.user) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-6 xl:px-0">
        <div className="flex min-h-56 items-center justify-center">
          <Spinner />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 xl:px-0">
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
