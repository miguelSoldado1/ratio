import { Link } from "@tanstack/react-router";
import { UserAvatar } from "@/components/user-avatar";
import type { ReactNode } from "react";

export interface UserListUser {
  avatarUrl?: string;
  displayName: string;
  id: string;
  subtitle?: string;
  username: string;
}

interface UserListProps<TUser extends UserListUser> {
  onUserSelect?: (user: TUser) => void;
  renderAction?: (user: TUser) => ReactNode;
  users: TUser[];
}

export function UserList<TUser extends UserListUser>({ onUserSelect, renderAction, users }: UserListProps<TUser>) {
  if (users.length === 0) {
    return <p className="px-2 py-8 text-center text-muted-foreground text-sm">No users yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {users.map((user) => (
        <li
          className="flex min-w-0 items-center gap-2 rounded-2xl transition-[background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-muted/60 has-[[data-slot=user-list-action]:focus-within]:bg-transparent has-[[data-slot=user-list-action]:hover]:bg-transparent"
          key={user.id}
        >
          <Link
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left transition-[transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.99]"
            onClick={() => onUserSelect?.(user)}
            params={{ username: user.username }}
            to="/user/$username"
          >
            <UserAvatar className="size-11 text-sm" height={44} name={user.displayName} src={user.avatarUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground text-sm">{user.displayName}</span>
              <span className="block truncate text-muted-foreground text-xs">
                {user.subtitle ?? `@${user.username}`}
              </span>
            </span>
          </Link>
          {renderAction ? (
            <div className="shrink-0 pr-1" data-slot="user-list-action">
              {renderAction(user)}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
