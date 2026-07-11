import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminAuthShell } from "@/components/admin-auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (accessQuery.data?.status !== "forbidden") {
    return null;
  }

  return (
    <AdminAuthShell>
      <Card className="border-t-2 border-t-destructive/60">
        <CardHeader className="items-center gap-1 pb-2 text-center">
          <ShieldAlert className="mx-auto mb-2 size-9 text-destructive/80" />
          <CardTitle>Access denied</CardTitle>
          <CardDescription className="text-balance">
            This account doesn&apos;t have admin access. Contact an admin if you think this is a mistake.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Button
            className="w-full"
            disabled={isSigningOut}
            onClick={signOutAndRetry}
            size="lg"
            type="button"
            variant="destructive"
          >
            Sign out and try another account
          </Button>
        </CardContent>
      </Card>
    </AdminAuthShell>
  );
}
