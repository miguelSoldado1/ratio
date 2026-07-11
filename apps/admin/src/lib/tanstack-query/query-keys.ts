export const adminAccessQueryKeys = {
  all: () => ["admin", "access"] as const,
};

export const adminReviewQueryKeys = {
  all: () => ["admin", "review"] as const,
  stats: () => [...adminReviewQueryKeys.all(), "stats"] as const,
  table: (params: unknown) => [...adminReviewQueryKeys.all(), "table", params] as const,
};

export const adminUserQueryKeys = {
  all: () => ["admin", "user"] as const,
  stats: () => [...adminUserQueryKeys.all(), "stats"] as const,
  table: (params: unknown) => [...adminUserQueryKeys.all(), "table", params] as const,
};
