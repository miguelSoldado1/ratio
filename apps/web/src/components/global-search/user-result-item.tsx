import { CommandItem } from "@/components/ui/command";
import { UserAvatar } from "@/components/user-avatar";
import type { UserResult } from "./types";

interface UserResultItemProps {
  onSelect: (user: UserResult) => void;
  user: UserResult;
}

export function UserResultItem({ user, onSelect }: UserResultItemProps) {
  const displayName = user.displayUsername ?? `@${user.username}`;

  return (
    <CommandItem className="items-center gap-3 py-2.5" onSelect={() => onSelect(user)} value={`user:${user.username}`}>
      <UserAvatar className="size-10 text-xs" name={displayName} src={user.avatarUrl} />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-foreground text-sm">{displayName}</p>
        {user.displayUsername ? <p className="truncate text-muted-foreground text-xs">@{user.username}</p> : null}
      </div>
    </CommandItem>
  );
}
