import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getAdminAccessState } from "@/server/admin-functions";

export const Route = createFileRoute("/")({
  loader: () => getAdminAccessState(),
  component: AdminHome,
});

const providers = ["spotify", "google", "discord"] as const;

function AdminHome() {
  const access = Route.useLoaderData();
  const [pending, setPending] = useState(false);

  async function signIn(provider: (typeof providers)[number]) {
    setPending(true);
    await authClient.signIn.social({ callbackURL: "/", provider, requestSignUp: false });
    setPending(false);
  }

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    window.location.assign("/");
  }

  return (
    <main>
      <h1>Ratio Admin</h1>
      {access.status === "unauthenticated" ? (
        <section>
          <p>Sign in with an existing Ratio account.</p>
          <div className="actions">
            {providers.map((provider) => (
              <button disabled={pending} key={provider} onClick={() => signIn(provider)} type="button">
                Sign in with {provider[0].toUpperCase() + provider.slice(1)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {access.status === "forbidden" ? (
        <section>
          <p>Access denied. This account is not an administrator.</p>
          <button disabled={pending} onClick={signOut} type="button">
            Sign out
          </button>
        </section>
      ) : null}
      {access.status === "authorized" ? (
        <section>
          <p>Hello, {access.user.name}</p>
          <button disabled={pending} onClick={signOut} type="button">
            Sign out
          </button>
        </section>
      ) : null}
    </main>
  );
}
