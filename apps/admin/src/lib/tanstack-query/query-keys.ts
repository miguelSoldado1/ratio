export const adminQueryKeys = {
  access: () => ["admin", "access"] as const,
  users: (params: unknown) => ["admin", "users", params] as const,
};
