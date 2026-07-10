import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/")({
  component: AdminHome,
});

function AdminHome() {
  const accessQuery = useAdminAccess();
  const user = accessQuery.data?.status === "authorized" ? accessQuery.data.user : null;
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      return toast.error("Couldn't sign out", { description: error.message });
    }

    window.location.assign("/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="heading-section">Ratio Admin</p>
          <h1 className="font-heading font-semibold text-2xl tracking-tight">Dashboard</h1>
        </div>
        <Button disabled={isSigningOut} onClick={signOut} type="button" variant="outline">
          {isSigningOut ? <Spinner data-icon="inline-start" /> : null}
          Sign out
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">Signed in as {user?.name}.</p>
      <div>
        <Link className="font-medium text-sm underline underline-offset-4" to="/users">
          Manage users
        </Link>
      </div>
    </main>
  );
}
