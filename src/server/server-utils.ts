import { getRequestHeaders } from "@tanstack/react-start/server";
import { createAuth } from "@/lib/auth";
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
