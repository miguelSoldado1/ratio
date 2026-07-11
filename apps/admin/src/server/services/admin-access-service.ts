import type { AdminAccessState } from "../admin-access";

// Types

export interface AdminSessionContext {
  access: AdminAccessState;
}

// Services

export function getAdminAccessStateService({ access }: AdminSessionContext) {
  return access;
}
