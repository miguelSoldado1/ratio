import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LastUsedBadge } from "@/components/last-used-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/auth-client";
import { authProviders } from "@/lib/auth/providers";
import type { AuthProviderId } from "@/lib/auth/providers";

interface AuthDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function AuthDialog({ onOpenChange, open }: AuthDialogProps) {
  const [pendingProvider, setPendingProvider] = useState<AuthProviderId | null>(null);
  const lastUsedMethod = authClient.getLastUsedLoginMethod();
  const returnUrl = getCurrentAuthReturnUrl();

  useEffect(() => {
    function resetPendingProvider() {
      setPendingProvider(null);
    }

    if (open) {
      resetPendingProvider();
    }

    window.addEventListener("pageshow", resetPendingProvider);

    return () => {
      window.removeEventListener("pageshow", resetPendingProvider);
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
      toast.error("Authentication failed", {
        description: authError.message ?? "Could not continue. Try again.",
      });
      setPendingProvider(null);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-105">
        <DialogHeader className="gap-2 pr-7">
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
              {id === lastUsedMethod && <LastUsedBadge />}
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
