import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogIn, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { GlobalSearch } from "@/components/global-search/global-search";
import { GlobalSearchTrigger } from "@/components/global-search/global-search-trigger";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth/auth-client";
import { useAuthRedirectErrorToast } from "@/lib/auth/use-auth-redirect-error-toast";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useAuthRedirectErrorToast(setAuthDialogOpen);

  return (
    <>
      <AuthDialog onOpenChange={setAuthDialogOpen} open={authDialogOpen} />
      <GlobalSearch onOpenChange={setSearchOpen} open={searchOpen} />
      <div className="sticky top-0 z-40 border-border/80 border-b bg-background/95 px-4 py-3 backdrop-blur-md sm:px-6 xl:px-16 2xl:px-24">
        <div className="mx-auto grid w-full max-w-375 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <LogoHomeLink />
          <div className="hidden min-w-0 justify-center lg:flex">
            <GlobalSearchTrigger className="max-w-108" onOpen={() => setSearchOpen(true)} />
          </div>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <GlobalSearchTrigger className="lg:hidden" compact onOpen={() => setSearchOpen(true)} />
            <HeaderAuthActions onAuthClick={() => setAuthDialogOpen(true)} />
          </div>
        </div>
      </div>
    </>
  );
}

interface HeaderAuthActionsProps {
  onAuthClick: () => void;
}

function HeaderAuthActions({ onAuthClick }: HeaderAuthActionsProps) {
  const navigate = useNavigate();
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
      alt={displayName}
      className="size-7 text-[11px]"
      fallbackInitial="A"
      height={28}
      name={displayName}
      src={user.image}
    />
  );

  return (
    <div className="flex items-center rounded-full bg-muted/40 p-0.5">
      {profileUsername ? (
        <Link
          aria-label={`View ${displayName}'s profile`}
          className="inline-flex size-8 min-w-0 items-center justify-center rounded-full transition-[background-color,transform] hover:bg-background/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.97] lg:w-auto lg:max-w-52 lg:justify-start lg:gap-2 lg:px-1 lg:pr-2"
          params={{ username: profileUsername }}
          to="/user/$username"
        >
          {avatar}
          <span className="hidden min-w-0 truncate text-muted-foreground text-sm lg:inline">{displayName}</span>
        </Link>
      ) : (
        <div className="inline-flex size-8 min-w-0 items-center justify-center lg:w-auto lg:max-w-52 lg:justify-start lg:gap-2 lg:px-1 lg:pr-2">
          {avatar}
          <span className="hidden min-w-0 truncate text-muted-foreground text-sm lg:inline">{displayName}</span>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Open account menu"
              className="size-8 rounded-full px-0 text-muted-foreground hover:bg-background/80 active:scale-[0.97]"
              type="button"
              variant="ghost"
            />
          }
        >
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                navigate({ to: "/settings" });
              }}
            >
              <Settings />
              Account settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={isSigningOut} onClick={handleSignOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
