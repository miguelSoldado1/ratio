import { hasAdminRole } from "@/lib/roles";

export interface AdminUser {
  id: string;
  image: string | null;
  name: string;
}

export type AdminSession = {
  user: {
    id: string;
    image?: string | null;
    name: string;
    role?: string | null;
  };
} | null;

export type AdminAccessState =
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: AdminUser }
  | { status: "authorized"; user: AdminUser };

export function decideAdminAccess(session: AdminSession): AdminAccessState {
  if (!session?.user) return { status: "unauthenticated" };

  const user = { id: session.user.id, image: session.user.image ?? null, name: session.user.name };
  return hasAdminRole(session.user.role) ? { status: "authorized", user } : { status: "forbidden", user };
}
