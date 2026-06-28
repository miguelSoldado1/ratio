import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, LogIn, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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

interface HeaderAuthActionsProps {
  onAuthClick: () => void;
}

export function HeaderAuthActions({ onAuthClick }: HeaderAuthActionsProps) {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const user = session.data?.user;

  async function handleSignOut() {
    setIsSigningOut(true);

    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      return toast.error("Sign out failed", {
        description: error.message ?? "Could not sign out. Try again.",
      });
    }

    setIsSigningOut(false);
  }

  if (session.isPending) {
    return <div className="size-8 rounded-full bg-muted" />;
  }

  if (!user) {
    return (
      <div className="flex items-center rounded-full bg-muted/40 p-0.5">
        <Button
          className="h-8 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:bg-background/80 hover:text-foreground active:scale-[0.97] sm:px-3"
          onClick={onAuthClick}
          type="button"
          variant="ghost"
        >
          <LogIn className="size-4" />
          <span className="text-sm">Sign in</span>
        </Button>
      </div>
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
