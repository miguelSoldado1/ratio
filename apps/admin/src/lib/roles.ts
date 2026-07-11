// user.role is a comma-separated list (e.g. "user,admin")

export function parseRoles(role: string | null | undefined) {
  const roles = (role ?? "user")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return roles.length > 0 ? roles : ["user"];
}

export function hasAdminRole(role: string | null | undefined) {
  return parseRoles(role).includes("admin");
}

// The role column is free-form text, so unknown values are passed through as-is
// to avoid rewriting roles this app doesn't know about.
export function withAdminRole(role: string | null | undefined) {
  return [...new Set([...parseRoles(role), "admin"])];
}

export function withoutAdminRole(role: string | null | undefined) {
  const roles = parseRoles(role).filter((value) => value !== "admin");
  return roles.length > 0 ? roles : ["user"];
}
