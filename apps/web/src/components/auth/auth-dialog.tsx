import { authProviders } from "@ratio/auth-providers/icons";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/auth-client";
import type { AuthProviderId } from "@ratio/auth-providers";

interface AuthDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function AuthDialog({ onOpenChange, open }: AuthDialogProps) {
  const [pendingProvider, setPendingProvider] = useState<AuthProviderId | null>(null);
  const session = authClient.useSession();
  const canOpen = !(session.isPending || session.data?.user);
  const returnUrl = getCurrentAuthReturnUrl();

  useEffect(() => {
    if (open && session.data?.user) onOpenChange(false);
  }, [onOpenChange, open, session.data?.user]);

  useEffect(() => {
    function syncDialogState() {
      setPendingProvider(null);
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
    <Dialog onOpenChange={onOpenChange} open={open && canOpen}>
      <DialogContent size="md">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl">Continue to Ratio</DialogTitle>
          <DialogDescription>Sign in or create an account to continue.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {authProviders.map(({ id, label, icon: Icon }) => (
            <Button
              aria-label={`Continue with ${label}`}
              className="w-full"
              disabled={pendingProvider !== null}
              key={id}
              onClick={() => continueWithProvider(id)}
              type="button"
              variant="outline"
            >
              <Icon data-icon="inline-start" />
              {`Continue with ${label}`}
            </Button>
          ))}
        </div>
        <p className="text-center text-muted-foreground text-xs leading-relaxed">
          By continuing, you agree to the{" "}
          <Link
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            onClick={() => onOpenChange(false)}
            to="/terms"
          >
            Terms
          </Link>{" "}
          and acknowledge the{" "}
          <Link
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            onClick={() => onOpenChange(false)}
            to="/privacy"
          >
            Privacy Policy
          </Link>
          .
        </p>
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
