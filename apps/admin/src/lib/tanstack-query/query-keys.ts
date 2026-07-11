export const adminQueryKeys = {
  access: () => ["admin", "access"] as const,
  users: {
    all: () => ["admin", "users"] as const,
    table: (params: unknown) => [...adminQueryKeys.users.all(), params] as const,
  },
};
