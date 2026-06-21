import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlbumSearchInput, AlbumSearchOverlay } from "@/components/album-search";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { getAuthErrorMessage } from "@/lib/auth/auth-errors";

function LogoHomeLink() {
  return (
    <Link
      aria-label="Go to home"
      className="inline-flex size-8 items-center justify-center rounded-sm transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      to="/"
    >
      <img alt="" className="size-8 shrink-0" height={32} src="/favicon-dark.ico" width={32} />
    </Link>
  );
}

export function TopBar() {
  const navigate = useNavigate();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useAuthRedirectErrorToast();

  const handleAlbumSelect = (album: { id: string }) => {
    navigate({ to: "/album/$albumId", params: { albumId: album.id } });
  };

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <AlbumSearchOverlay
        isOpen={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        onSelect={handleAlbumSelect}
      />
      <div className="border-border border-b px-6 py-4 xl:px-16 2xl:px-24">
        {/* Mobile: logo left, actions right */}
        <div className="flex items-center justify-between lg:hidden">
          <LogoHomeLink />
          <div className="flex items-center gap-3">
            <button
              aria-label="Search"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileSearchOpen(true)}
              type="button"
            >
              <Search className="size-5" />
            </button>
            <HeaderAuthActions compact onAuthClick={() => setAuthDialogOpen(true)} />
          </div>
        </div>
        {/* Desktop: three-column */}
        <div className="hidden grid-cols-3 items-center gap-4 lg:grid">
          <LogoHomeLink />
          <AlbumSearchInput onSelect={handleAlbumSelect} />
          <HeaderAuthActions onAuthClick={() => setAuthDialogOpen(true)} />
        </div>
      </div>
    </>
  );
}

function useAuthRedirectErrorToast() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const error = url.searchParams.get("error");
    if (!error) return;

    toast.error("Authentication failed", {
      description: getAuthErrorMessage(error),
      id: `auth-error-${error}`,
    });

    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
}

interface HeaderAuthActionsProps {
  compact?: boolean;
  onAuthClick: () => void;
}

function HeaderAuthActions({ compact = false, onAuthClick }: HeaderAuthActionsProps) {
  const session = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const user = session.data?.user;

  async function handleSignOut() {
    setIsSigningOut(true);

    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      toast.error("Sign out failed", {
        description: error.message ?? "Could not sign out. Try again.",
      });
      return;
    }

    setIsSigningOut(false);
  }

  if (session.isPending) {
    return <div className="size-8 rounded-full bg-muted" />;
  }

  if (!user) {
    return (
      <Button onClick={onAuthClick} size="sm" type="button" variant="outline">
        Sign in
      </Button>
    );
  }

  const displayName = user.displayUsername ?? user.username ?? user.name ?? "Account";

  return (
    <div className="flex items-center justify-end gap-2.5">
      {!compact && <span className="max-w-36 truncate text-muted-foreground text-sm">{displayName}</span>}
      <UserAvatar image={user.image} name={displayName} />
      <Button
        aria-label="Sign out"
        className="text-muted-foreground hover:text-foreground"
        disabled={isSigningOut}
        onClick={handleSignOut}
        size="icon-sm"
        title="Sign out"
        type="button"
        variant="ghost"
      >
        <LogOut />
      </Button>
    </div>
  );
}

interface UserAvatarProps {
  image?: null | string;
  name: string;
}

function UserAvatar({ image, name }: UserAvatarProps) {
  const initial = name.trim().charAt(0) || "A";

  if (image) {
    return <img alt="" className="size-8 shrink-0 rounded-full object-cover" height={32} src={image} width={32} />;
  }

  return (
    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-medium text-primary-foreground text-xs uppercase">
      {initial}
    </div>
  );
}
