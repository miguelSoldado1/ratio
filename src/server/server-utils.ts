import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq, lt, or } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import type { AnyColumn } from "drizzle-orm/column";
import type { ZodType } from "zod";
import type { Db } from "@/lib/db";

// Auth

export async function getOptionalCurrentUserId(db: Db) {
  const auth = createAuth(db);
  const session = await auth.api.getSession({ headers: getRequestHeaders() }).catch(() => null);

  return session?.user.id;
}

// Cursors

const base64PaddingPattern = /=+$/;

export function encodeCursor<TPayload>(cursor: TPayload) {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(base64PaddingPattern, "");
}

export function decodeCursor<TPayload>(cursor: string, schema: ZodType<TPayload>, errorMessage: string): TPayload {
  try {
    const base64Cursor = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const paddedCursor = base64Cursor.padEnd(Math.ceil(base64Cursor.length / 4) * 4, "=");
    const parsedCursor: unknown = JSON.parse(atob(paddedCursor));

    return schema.parse(parsedCursor);
  } catch {
    throw new Error(errorMessage);
  }
}

export function getCreatedAtIdCursorFilter(
  cursor: { createdAt: string; id: string },
  columns: {
    createdAt: AnyColumn<{ data: Date }>;
    id: AnyColumn<{ data: string }>;
  }
) {
  const cursorCreatedAt = new Date(cursor.createdAt);

  return or(
    lt(columns.createdAt, cursorCreatedAt),
    and(eq(columns.createdAt, cursorCreatedAt), lt(columns.id, cursor.id))
  );
}
