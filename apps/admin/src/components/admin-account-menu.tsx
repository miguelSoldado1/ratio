import { ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";
import type { AdminUser } from "@/server/admin-access";

interface AdminAccountMenuProps {
  user: AdminUser;
}

export function AdminAccountMenu({ user }: AdminAccountMenuProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      return toast.error("Couldn't sign out", { description: error.message });
    }

    window.location.assign("/sign-in");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open account menu"
            className="h-9 min-w-0 max-w-52 gap-1.5 rounded-full bg-muted/40 px-1.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
            type="button"
            variant="ghost"
          />
        }
      >
        <UserAvatar className="size-7 text-2xs" name={user.name} src={user.image} />
        <span className="hidden min-w-0 truncate text-sm sm:inline">{user.name}</span>
        <ChevronDown aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={isSigningOut} onClick={handleSignOut}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
