import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminAuthShell } from "@/components/admin-auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { authClient } from "@/lib/auth-client";
import { authRedirectSearchSchema, getSafeAuthRedirect, getSignInHref } from "@/lib/auth-redirect";

export const Route = createFileRoute("/access-denied")({
  validateSearch: authRedirectSearchSchema,
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const { redirect: requestedRedirect } = Route.useSearch();
  const redirectTarget = getSafeAuthRedirect(requestedRedirect);
  const accessQuery = useAdminAccess();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (accessQuery.data?.status === "unauthenticated") {
      navigate({ replace: true, search: { redirect: redirectTarget }, to: "/sign-in" });
    }

    if (accessQuery.data?.status === "authorized") {
      window.location.replace(redirectTarget);
    }
  }, [accessQuery.data?.status, navigate, redirectTarget]);

  async function signOutAndRetry() {
    setIsSigningOut(true);
    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      return toast.error("Couldn't sign out", { description: error.message });
    }

    window.location.assign(getSignInHref(redirectTarget));
  }

  if (accessQuery.data?.status !== "forbidden") return null;

  return (
    <AdminAuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>This account cannot access Ratio Admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" disabled={isSigningOut} onClick={signOutAndRetry} size="lg" type="button">
            {isSigningOut ? <Spinner data-icon="inline-start" /> : null}
            Sign out and try another account
          </Button>
        </CardContent>
      </Card>
    </AdminAuthShell>
  );
}
