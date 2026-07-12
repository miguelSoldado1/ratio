import { hasAdminRole } from "@/lib/roles";

export interface AdminUser {
  avatarUrl: string | null;
  displayName: string;
  id: string;
}

export type AdminSession = {
  user: {
    id: string;
    displayUsername?: string | null;
    image?: string | null;
    name: string;
    role?: string | null;
    username?: string | null;
  };
} | null;

export type AdminAccessState =
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: AdminUser }
  | { status: "authorized"; user: AdminUser };

export function decideAdminAccess(session: AdminSession): AdminAccessState {
  if (!session?.user) return { status: "unauthenticated" };

  const user = {
    avatarUrl: session.user.image ?? null,
    displayName: session.user.displayUsername ?? session.user.username ?? session.user.name,
    id: session.user.id,
  };
  return hasAdminRole(session.user.role) ? { status: "authorized", user } : { status: "forbidden", user };
}
