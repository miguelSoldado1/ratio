import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";

export const Route = createFileRoute("/")({ component: App });

const providers = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
  { id: "spotify", label: "Spotify" },
] as const;

type ProviderId = (typeof providers)[number]["id"];
type LinkedAccount = {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  scopes: string[];
};

function App() {
  const session = authClient.useSession();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);
  const [pendingUnlinkAccountId, setPendingUnlinkAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!session.data) {
      setLinkedAccounts([]);
      return;
    }

    void refreshLinkedAccounts();
  }, [session.data]);

  async function signOut() {
    const { error } = await authClient.signOut();

    if (error) {
      toast.error("Sign out failed", {
        description: error.message ?? "Could not sign out. Try again.",
      });
      return;
    }

    await session.refetch();
  }

  async function refreshLinkedAccounts() {
    const { data, error } = await authClient.listAccounts();

    if (error) {
      toast.error("Could not load linked accounts", {
        description: error.message ?? "Try refreshing the page.",
      });
      return;
    }

    setLinkedAccounts(data);
  }

  async function linkProvider(provider: ProviderId) {
    setPendingProvider(provider);

    const { error } = await authClient.linkSocial({
      provider,
      callbackURL: "/",
      errorCallbackURL: "/",
    });

    if (error) {
      toast.error("Could not link account", {
        description: error.message ?? "Try again.",
      });
      setPendingProvider(null);
    }
  }

  async function unlinkAccount(account: LinkedAccount) {
    setPendingUnlinkAccountId(account.id);

    const { error } = await authClient.unlinkAccount({
      providerId: account.providerId,
      accountId: account.accountId,
    });

    if (error) {
      toast.error("Could not unlink account", {
        description: error.message ?? "Try again.",
      });
      setPendingUnlinkAccountId(null);
      return;
    }

    toast.success("Account unlinked");
    await refreshLinkedAccounts();
    setPendingUnlinkAccountId(null);
  }

  const linkedProviderIds = new Set(linkedAccounts.map((account) => account.providerId));

  return (
    <main className="min-h-svh p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Session</h1>
            <p className="text-sm text-muted-foreground">
              {session.isPending
                ? "Checking authentication..."
                : session.data
                  ? "You are signed in."
                  : "You are not signed in."}
            </p>
          </div>

          {session.data ? (
            <Button type="button" variant="outline" disabled={session.isRefetching} onClick={() => void signOut()}>
              Sign out
            </Button>
          ) : (
            <Button render={<a href="/sign-in" />}>Sign in</Button>
          )}
        </div>

        <section className="grid gap-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-medium">User</h2>
          {session.data?.user ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-[120px_1fr]">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{session.data.user.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{session.data.user.email}</dd>
              <dt className="text-muted-foreground">Verified</dt>
              <dd>{session.data.user.emailVerified ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="break-all">{session.data.user.id}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No user details available.</p>
          )}
        </section>

        {session.data ? (
          <section className="grid gap-4 rounded-md border border-border bg-card p-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium">Linked accounts</h2>
              <p className="text-sm text-muted-foreground">Connect providers from here after signing in.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {providers.map((provider) => {
                const isLinked = linkedProviderIds.has(provider.id);
                const isPending = pendingProvider === provider.id;

                return (
                  <Button
                    key={provider.id}
                    type="button"
                    variant={isLinked ? "secondary" : "outline"}
                    disabled={isLinked || pendingProvider !== null}
                    onClick={() => void linkProvider(provider.id)}
                  >
                    {isPending ? "Redirecting..." : isLinked ? `${provider.label} linked` : `Link ${provider.label}`}
                  </Button>
                );
              })}
            </div>

            {linkedAccounts.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Provider</th>
                      <th className="px-3 py-2 font-medium">Account ID</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedAccounts.map((account) => {
                      const isPending = pendingUnlinkAccountId === account.id;

                      return (
                        <tr key={account.id} className="border-t border-border">
                          <td className="px-3 py-2">{account.providerId}</td>
                          <td className="px-3 py-2 break-all">{account.accountId}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={pendingUnlinkAccountId !== null || pendingProvider !== null}
                              onClick={() => void unlinkAccount(account)}
                            >
                              {isPending ? "Unlinking..." : "Unlink"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No linked provider accounts found.</p>
            )}
          </section>
        ) : null}

        <section className="grid gap-3 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Raw session details</h2>
          <pre className="max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
            {JSON.stringify(session.data ?? null, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
