import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isAdminRole } from "./server-utils";
import type { Db } from "@/lib/db";

export interface AuthenticatedContext {
  db: Db;
  user: {
    id: string;
    isAdmin: boolean;
  };
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const db = await getDb();
  const auth = createAuth(db);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return await next({
    context: {
      db,
      user: {
        id: session.user.id,
        isAdmin: isAdminRole(session.user.role),
      },
    } satisfies AuthenticatedContext,
  });
});
