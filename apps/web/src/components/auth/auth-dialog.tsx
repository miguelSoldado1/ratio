import { authProviders } from "@ratio/auth-providers/icons";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthMethodBadge } from "@/components/auth/auth-method-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/auth-client";
import type { AuthProviderId } from "@ratio/auth-providers";

interface AuthDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function AuthDialog({ onOpenChange, open }: AuthDialogProps) {
  const [lastUsedMethod, setLastUsedMethod] = useState<string | null>();
  const [pendingProvider, setPendingProvider] = useState<AuthProviderId | null>(null);
  const returnUrl = getCurrentAuthReturnUrl();

  useEffect(() => {
    function syncDialogState() {
      setPendingProvider(null);
      setLastUsedMethod(authClient.getLastUsedLoginMethod());
    }

    if (open) {
      syncDialogState();
    }

    window.addEventListener("pageshow", syncDialogState);

    return () => {
      window.removeEventListener("pageshow", syncDialogState);
    };
  }, [open]);

  async function continueWithProvider(provider: AuthProviderId) {
    setPendingProvider(provider);

    const { error: authError } = await authClient.signIn.social({
      callbackURL: returnUrl,
      errorCallbackURL: returnUrl,
      provider,
    });

    if (authError) {
      toast.error("Couldn't sign in", {
        description: authError.message ?? "Something went wrong. Try again.",
      });
      setPendingProvider(null);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent size="md">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl">Continue to Ratio</DialogTitle>
          <DialogDescription>Sign in or create an account to continue.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
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
                <Icon data-icon="inline-start" />
                {`Continue with ${label}`}
              </Button>
              {id === lastUsedMethod && <AuthMethodBadge variant="secondary">Last used</AuthMethodBadge>}
              {id === "spotify" && lastUsedMethod === null && (
                <AuthMethodBadge variant="default">Recommended</AuthMethodBadge>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getCurrentAuthReturnUrl() {
  if (typeof window === "undefined") return "/";

  const url = new URL(window.location.href);
  url.searchParams.delete("error");

  return `${url.pathname}${url.search}${url.hash}`;
}
