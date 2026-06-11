import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { LastUsedBadge } from "@/components/last-used-badge";

export const Route = createFileRoute("/_auth/sign-in")({
  validateSearch: (search) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: RouteComponent,
});

const GoogleIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
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

const AppleIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

const SpotifyIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const providers = [
  { id: "google", label: "Google", icon: GoogleIcon },
  { id: "apple", label: "Apple", icon: AppleIcon },
  { id: "spotify", label: "Spotify", icon: SpotifyIcon },
] as const;

function RouteComponent() {
  const [pendingProvider, setPendingProvider] = useState<(typeof providers)[number]["id"] | null>(null);

  const { error } = Route.useSearch();
  const lastUsedMethod = authClient.getLastUsedLoginMethod();

  useEffect(() => {
    if (!error) return;
    toast.error("Sign in failed", { id: `auth-error-${error}`, description: getAuthErrorMessage(error) });
  }, [error]);

  async function signIn(provider: (typeof providers)[number]["id"]) {
    setPendingProvider(provider);

    const { error: signInError } = await authClient.signIn.social({
      provider,
      callbackURL: "/",
      errorCallbackURL: "/sign-in",
    });

    if (signInError) {
      toast.error("Sign in failed", { description: signInError.message ?? "Could not start sign in. Try again." });
      setPendingProvider(null);
    }
  }

  const renderButton = ({ id, label, icon: Icon }: (typeof providers)[number], isLastUsed = false) => {
    return (
      <div key={id} className="relative">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pendingProvider !== null}
          aria-label={`Continue with ${label}`}
          onClick={() => void signIn(id)}
        >
          <Icon />
          {`Continue with ${label}`}
        </Button>
        {isLastUsed && <LastUsedBadge />}
      </div>
    );
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left panel */}
      <div className="hidden bg-foreground lg:block dark:bg-card" />

      {/* Right panel */}
      <div className="flex items-center justify-center p-8">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
          </div>

          <div className="flex flex-col gap-2">{providers.map((p) => renderButton(p, p.id === lastUsedMethod))}</div>
        </div>
      </div>
    </div>
  );
}

function getAuthErrorMessage(error: string) {
  return error
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
