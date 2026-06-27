import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LastUsedBadge } from "@/components/last-used-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/auth-client";
import type { SVGProps } from "react";

const GoogleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const DiscordIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M20.317 4.369A19.79 19.79 0 0 0 15.373 2.8a13.73 13.73 0 0 0-.633 1.299 18.43 18.43 0 0 0-5.48 0A12.9 12.9 0 0 0 8.627 2.8a19.736 19.736 0 0 0-4.947 1.572C.55 9.002-.304 13.515.12 17.963a19.956 19.956 0 0 0 6.063 3.038 14.68 14.68 0 0 0 1.297-2.083 12.91 12.91 0 0 1-2.043-.976c.171-.124.338-.253.5-.386a14.15 14.15 0 0 0 12.126 0c.164.134.331.263.5.386-.651.382-1.337.71-2.045.977.376.733.81 1.43 1.298 2.082a19.918 19.918 0 0 0 6.064-3.039c.499-5.157-.851-9.629-3.563-13.593ZM8.02 15.226c-1.182 0-2.157-1.08-2.157-2.407 0-1.328.956-2.408 2.157-2.408 1.21 0 2.176 1.09 2.157 2.408 0 1.327-.956 2.407-2.157 2.407Zm7.96 0c-1.183 0-2.157-1.08-2.157-2.407 0-1.328.955-2.408 2.157-2.408 1.21 0 2.176 1.09 2.156 2.408 0 1.327-.946 2.407-2.156 2.407Z" />
  </svg>
);

const SpotifyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const providers = [
  { icon: GoogleIcon, id: "google", label: "Google" },
  { icon: SpotifyIcon, id: "spotify", label: "Spotify" },
  { icon: DiscordIcon, id: "discord", label: "Discord" },
] as const;

type AuthProvider = (typeof providers)[number];
type AuthProviderId = AuthProvider["id"];

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
          {providers.map(({ id, label, icon: Icon }) => (
            <div className="relative" key={id}>
              <Button
                aria-label={`Continue with ${label}`}
                className="w-full"
                disabled={pendingProvider !== null}
                onClick={() => {
                  continueWithProvider(id);
                }}
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
