import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createAdminAuth } from "@/lib/auth.server";
import { getDb } from "@/lib/db";
import { decideAdminAccess } from "./admin-access";

export const adminSessionMiddleware = createMiddleware().server(async ({ next }) => {
  const db = await getDb();
  const auth = createAdminAuth(db);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  const access = decideAdminAccess(session);

  return await next({ context: { access, db } });
});

export const requireAdminMiddleware = createMiddleware()
  .middleware([adminSessionMiddleware])
  .server(async ({ context, next }) => {
    if (context.access.status === "unauthenticated") {
      throw new Response("Unauthorized", { status: 401 });
    }

    if (context.access.status === "forbidden") {
      throw new Response("Forbidden", { status: 403 });
    }

    return await next({
      context: {
        db: context.db,
        user: context.access.user,
      },
    });
  });
