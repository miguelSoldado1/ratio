export type AdminSession = {
  user: {
    id: string;
    name: string;
    role?: string | null;
  };
} | null;

export type AdminAccessState =
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: { id: string; name: string } }
  | { status: "authorized"; user: { id: string; name: string } };

export function hasAdminRole(role: string | null | undefined) {
  return (
    role
      ?.split(",")
      .map((value) => value.trim())
      .includes("admin") ?? false
  );
}

export function decideAdminAccess(session: AdminSession): AdminAccessState {
  if (!session?.user) return { status: "unauthenticated" };

  const user = { id: session.user.id, name: session.user.name };
  return hasAdminRole(session.user.role) ? { status: "authorized", user } : { status: "forbidden", user };
}
