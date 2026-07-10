import { authProviders } from "@ratio/auth-providers";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminAuthShell } from "@/components/admin-auth-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { authClient } from "@/lib/auth-client";
import { authRedirectSearchSchema, getSafeAuthRedirect, getSignInHref } from "@/lib/auth-redirect";
import type { AuthProviderId } from "@ratio/auth-providers";

export const Route = createFileRoute("/sign-in")({
  validateSearch: authRedirectSearchSchema,
  component: SignInPage,
});

function SignInPage() {
  const accessQuery = useAdminAccess();
  const navigate = useNavigate();
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>();
  const [pendingProvider, setPendingProvider] = useState<AuthProviderId | null>(null);

  const search = Route.useSearch();
  const redirectTarget = getSafeAuthRedirect(search.redirect);

  useEffect(() => {
    if (accessQuery.data?.status === "authorized") {
      window.location.replace(redirectTarget);
    }

    if (accessQuery.data?.status === "forbidden") {
      navigate({ replace: true, search: { redirect: redirectTarget }, to: "/access-denied" });
    }
  }, [accessQuery.data?.status, navigate, redirectTarget]);

  useEffect(() => {
    function syncSignInState() {
      setPendingProvider(null);
      setLastUsedMethod(authClient.getLastUsedLoginMethod());
    }

    syncSignInState();
    window.addEventListener("pageshow", syncSignInState);

    return () => window.removeEventListener("pageshow", syncSignInState);
  }, []);

  useEffect(() => {
    if (!search.error) return;

    const toastTimeoutId = window.setTimeout(() => {
      toast.error("Couldn't sign in", {
        description: "Use an existing Ratio account or try another provider.",
        id: `auth-error-${search.error}`,
      });
    }, 0);

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    return () => window.clearTimeout(toastTimeoutId);
  }, [search.error]);

  async function continueWithProvider(provider: AuthProviderId) {
    setPendingProvider(provider);

    const { error } = await authClient.signIn.social({
      callbackURL: redirectTarget,
      errorCallbackURL: getSignInHref(redirectTarget),
      provider,
      requestSignUp: false,
    });

    if (!error) return;

    toast.error("Couldn't sign in", {
      description: error.message ?? "Use an existing Ratio account or try another provider.",
    });
    setPendingProvider(null);
  }

  if (accessQuery.data?.status !== "unauthenticated") return null;

  return (
    <AdminAuthShell>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Sign in to Ratio Admin</CardTitle>
          <CardDescription>Use an existing Ratio account with administrator access.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {authProviders.map(({ id, label, icon: Icon }) => (
            <div className="relative" key={id}>
              <Button
                aria-label={`Continue with ${label}`}
                className="w-full"
                disabled={pendingProvider !== null}
                onClick={() => continueWithProvider(id)}
                type="button"
                variant="outline"
              >
                {pendingProvider === id ? <Spinner data-icon="inline-start" /> : <Icon data-icon="inline-start" />}
                Continue with {label}
              </Button>
              {id === lastUsedMethod ? (
                <Badge className="absolute -top-2 right-2" variant="secondary">
                  Last used
                </Badge>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminAuthShell>
  );
}
