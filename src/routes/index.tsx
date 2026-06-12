import { createFileRoute } from "@tanstack/react-router";
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
type EditableUserField = "username" | "displayUsername";
type PendingAction =
  | "signOut"
  | "deleteAccount"
  | `link:${ProviderId}`
  | `unlink:${string}`
  | `profile:${EditableUserField}`;
type ProfileEdit = {
  field: EditableUserField;
  value: string;
};
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
  const [profileEdit, setProfileEdit] = useState<ProfileEdit | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isActionPending, startActionTransition] = useTransition();

  useEffect(() => {
    if (!session.data) {
      setLinkedAccounts([]);
      setProfileEdit(null);
      return;
    }

    void refreshLinkedAccounts();
  }, [session.data]);

  function runAction(action: PendingAction, callback: () => Promise<void>) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action);
    startActionTransition(async () => {
      try {
        await callback();
      } finally {
        startActionTransition(() => {
          setPendingAction(null);
        });
      }
    });
  }

  async function signOutAction() {
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

  async function linkProviderAction(provider: ProviderId) {
    const { error } = await authClient.linkSocial({
      provider,
      callbackURL: "/",
      errorCallbackURL: "/",
    });

    if (error) {
      toast.error("Could not link account", {
        description: error.message ?? "Try again.",
      });
    }
  }

  async function unlinkAccountAction(account: LinkedAccount) {
    const { error } = await authClient.unlinkAccount({
      providerId: account.providerId,
      accountId: account.accountId,
    });

    if (error) {
      toast.error("Could not unlink account", {
        description: error.message ?? "Try again.",
      });
      return;
    }

    toast.success("Account unlinked");
    await refreshLinkedAccounts();
  }

  function startEditingProfileField(field: EditableUserField) {
    if (!session.data?.user) {
      return;
    }

    setProfileEdit({
      field,
      value: session.data.user[field] ?? "",
    });
  }

  async function updateProfileFieldAction(field: EditableUserField) {
    const value = profileEdit?.field === field ? profileEdit.value.trim() : "";

    if (!value) {
      toast.error(field === "username" ? "Username is required" : "Display name is required");
      return;
    }

    const { error } = await authClient.updateUser({ [field]: value });

    if (error) {
      toast.error(field === "username" ? "Could not update username" : "Could not update display name", {
        description: error.message ?? "Try another value.",
      });
      return;
    }

    toast.success(field === "username" ? "Username updated" : "Display name updated");
    await session.refetch();
    setProfileEdit(null);
  }

  async function deleteAccountAction() {
    const confirmed = window.confirm("Delete your account? This cannot be undone.");

    if (!confirmed) {
      return;
    }

    const { error } = await authClient.deleteUser({
      callbackURL: "/",
    });

    if (error) {
      toast.error("Could not delete account", {
        description: error.message ?? "Try signing in again, then retry.",
      });
      return;
    }

    toast.success("Account deleted");
    await session.refetch();
    window.location.href = "/";
  }

  const linkedProviderIds = new Set(linkedAccounts.map((account) => account.providerId));
  const isBusy = pendingAction !== null || isActionPending;

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
            <Button
              type="button"
              variant="outline"
              disabled={session.isRefetching || isBusy}
              onClick={() => runAction("signOut", signOutAction)}
            >
              {pendingAction === "signOut" ? "Signing out..." : "Sign out"}
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
              <dt className="text-muted-foreground">Username</dt>
              <dd>
                <EditableProfileField
                  label="username"
                  value={`@${session.data.user.username ?? "Not set"}`}
                  inputValue={profileEdit?.field === "username" ? profileEdit.value : ""}
                  isEditing={profileEdit?.field === "username"}
                  isPending={pendingAction === "profile:username"}
                  onChange={(value) => setProfileEdit({ field: "username", value })}
                  onEdit={() => startEditingProfileField("username")}
                  onCancel={() => setProfileEdit(null)}
                  onSave={() => runAction("profile:username", () => updateProfileFieldAction("username"))}
                />
              </dd>
              <dt className="text-muted-foreground">Display username</dt>
              <dd>
                <EditableProfileField
                  label="display username"
                  value={session.data.user.displayUsername ?? "Not set"}
                  inputValue={profileEdit?.field === "displayUsername" ? profileEdit.value : ""}
                  isEditing={profileEdit?.field === "displayUsername"}
                  isPending={pendingAction === "profile:displayUsername"}
                  onChange={(value) => setProfileEdit({ field: "displayUsername", value })}
                  onEdit={() => startEditingProfileField("displayUsername")}
                  onCancel={() => setProfileEdit(null)}
                  onSave={() => runAction("profile:displayUsername", () => updateProfileFieldAction("displayUsername"))}
                />
              </dd>
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
                const action = `link:${provider.id}` as const;
                const isPending = pendingAction === action;

                return (
                  <Button
                    key={provider.id}
                    type="button"
                    variant={isLinked ? "secondary" : "outline"}
                    disabled={isLinked || isBusy}
                    onClick={() => runAction(action, () => linkProviderAction(provider.id))}
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
                      const action = `unlink:${account.id}` as const;
                      const isPending = pendingAction === action;

                      return (
                        <tr key={account.id} className="border-t border-border">
                          <td className="px-3 py-2">{account.providerId}</td>
                          <td className="px-3 py-2 break-all">{account.accountId}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={isBusy}
                              onClick={() => runAction(action, () => unlinkAccountAction(account))}
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

        {session.data ? (
          <section className="grid gap-3 rounded-md border border-destructive/30 bg-card p-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-destructive">Delete account</h2>
              <p className="text-sm text-muted-foreground">Remove your user, sessions, and linked provider accounts.</p>
            </div>
            <div>
              <Button
                type="button"
                variant="destructive"
                disabled={isBusy}
                onClick={() => runAction("deleteAccount", deleteAccountAction)}
              >
                {pendingAction === "deleteAccount" ? "Deleting..." : "Delete account"}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function EditableProfileField({
  label,
  value,
  inputValue,
  isEditing,
  isPending,
  onChange,
  onEdit,
  onCancel,
  onSave,
}: {
  label: string;
  value: string;
  inputValue: string;
  isEditing: boolean;
  isPending: boolean;
  onChange: (value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex max-w-md items-center gap-2">
        <input
          aria-label={label}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
          disabled={isPending}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSave();
            }

            if (event.key === "Escape") {
              onCancel();
            }
          }}
        />
        <Button type="button" size="icon-sm" disabled={isPending} onClick={onSave}>
          <Check />
          <span className="sr-only">Save {label}</span>
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" disabled={isPending} onClick={onCancel}>
          <X />
          <span className="sr-only">Cancel editing {label}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 break-all">{value}</span>
      <Button type="button" size="icon-xs" variant="ghost" onClick={onEdit}>
        <Pencil />
        <span className="sr-only">Edit {label}</span>
      </Button>
    </div>
  );
}
