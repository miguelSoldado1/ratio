import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlbumSearchCommand, AlbumSearchTrigger } from "@/components/album-search";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth/auth-client";
import { useAuthRedirectErrorToast } from "@/lib/auth/use-auth-redirect-error-toast";
import { cn } from "@/lib/utils";

function LogoHomeLink() {
  return (
    <Link
      aria-label="Go to home"
      className="inline-flex size-10 items-center justify-start rounded-3xl transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      to="/"
    >
      <img alt="" className="size-8 shrink-0" height={32} src="/favicon-dark.ico" width={32} />
    </Link>
  );
}

export function TopBar() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useAuthRedirectErrorToast(setAuthDialogOpen);

  const handleAlbumSelect = (album: { id: string }) => {
    navigate({ to: "/album/$albumId", params: { albumId: album.id } });
  };

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <AlbumSearchCommand onOpenChange={setSearchOpen} onSelect={handleAlbumSelect} open={searchOpen} />
      <div className="border-border/80 border-b bg-background/95 px-4 py-3 sm:px-6 xl:px-16 2xl:px-24">
        <div className="mx-auto grid w-full max-w-375 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <LogoHomeLink />
          <div className="hidden min-w-0 justify-center lg:flex">
            <AlbumSearchTrigger className="max-w-108" onOpen={() => setSearchOpen(true)} />
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <AlbumSearchTrigger className="lg:hidden" compact onOpen={() => setSearchOpen(true)} />
            <HeaderAuthActions compact onAuthClick={() => setAuthDialogOpen(true)} />
          </div>
        </div>
      </div>
    </>
  );
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
      <Button
        className="border-primary/25 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.97]"
        onClick={onAuthClick}
        size="sm"
        type="button"
        variant="outline"
      >
        <LogIn data-icon="inline-start" />
        Sign in
      </Button>
    );
  }

  const displayName = user.displayUsername ?? user.username ?? user.name ?? "Account";
  const profileUsername = user.username?.toLowerCase();
  const avatar = (
    <UserAvatar
      alt={compact ? displayName : ""}
      className="size-8 text-xs"
      fallbackInitial="A"
      height={32}
      name={displayName}
      src={user.image}
    />
  );

  return (
    <div className="flex items-center gap-1.5">
      {profileUsername ? (
        <Link
          aria-label={`View ${displayName}'s profile`}
          className={cn(
            "inline-flex min-w-0 items-center gap-2 rounded-full transition-[opacity,transform] hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.97]",
            compact ? "size-8 justify-center" : "max-w-52 pr-2"
          )}
          params={{ username: profileUsername }}
          to="/user/$username"
        >
          {avatar}
          {compact ? null : <span className="truncate text-muted-foreground text-sm">{displayName}</span>}
        </Link>
      ) : (
        <div className={cn("inline-flex min-w-0 items-center gap-2", compact ? "size-8" : "max-w-52 pr-2")}>
          {avatar}
        </div>
      )}
      <Button
        aria-label="Sign out"
        className="rounded-full text-muted-foreground hover:text-foreground active:scale-[0.97]"
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
