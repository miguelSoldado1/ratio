import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import z from "zod";
import { account, session, user } from "@/lib/db/schema";
import { decodeCursor, encodeCursor } from "../server-utils";
import type { AuthenticatedContext } from "../auth-middleware";

// Constants

const adminUsersPageSize = 20;

// Schemas

const adminUsersCursorPayloadSchema = z.object({
  createdAt: z.string().trim().min(1),
  id: z.string().trim().min(1).max(128),
});

// Types

interface AdminUsersCursorPayload {
  createdAt: string;
  id: string;
}

export interface AdminUsersInput {
  cursor?: string;
  query?: string;
}

export interface AdminUser {
  banned: boolean;
  canBan: boolean;
  createdAt: Date;
  displayName: string | null;
  email: string;
  id: string;
  providerIds: string[];
  role: string | null;
  username: string | null;
}

export interface AdminUsersPage {
  nextCursor: string | null;
  totalUsers: number;
  users: AdminUser[];
}

export interface SetAdminUserBanInput {
  banned: boolean;
  userId: string;
}

interface AdminUserRow extends Omit<AdminUser, "banned" | "canBan" | "displayName" | "providerIds"> {
  banned: boolean | null;
  createdAtCursor: string;
  displayName: string | null;
  name: string;
}

interface AdminAccountRow {
  providerId: string;
  userId: string;
}

// Services

export async function listAdminUsersService(data: AdminUsersInput, context: AuthenticatedContext) {
  if (!context.user.isAdmin) {
    throw new Error("Forbidden");
  }

  const cursor = data.cursor ? decodeAdminUsersCursor(data.cursor) : undefined;
  const searchFilter = getAdminUsersSearchFilter(data.query);
  const [users, total] = await Promise.all([
    context.db
      .select({
        banned: user.banned,
        createdAt: user.createdAt,
        createdAtCursor: sql<string>`${user.createdAt}::text`,
        displayName: user.displayUsername,
        email: user.email,
        id: user.id,
        name: user.name,
        role: user.role,
        username: user.username,
      })
      .from(user)
      .where(and(searchFilter, cursor ? getAdminUsersCursorFilter(cursor) : undefined))
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(adminUsersPageSize + 1),
    getAdminUserCount(context, searchFilter),
  ]);

  if (users.length === 0) {
    return {
      nextCursor: null,
      totalUsers: total,
      users: [],
    };
  }

  const hasNextPage = users.length > adminUsersPageSize;
  const pageUsers = hasNextPage ? users.slice(0, adminUsersPageSize) : users;
  const accountRows = await context.db
    .select({
      providerId: account.providerId,
      userId: account.userId,
    })
    .from(account)
    .where(
      inArray(
        account.userId,
        pageUsers.map((userRow) => userRow.id)
      )
    )
    .orderBy(asc(account.providerId));

  return mapAdminUsersPage(pageUsers, accountRows, hasNextPage, context.user.id, total);
}

export async function setAdminUserBanService(data: SetAdminUserBanInput, context: AuthenticatedContext) {
  if (!context.user.isAdmin) {
    throw new Error("Forbidden");
  }

  if (data.userId === context.user.id) {
    throw new Error("You cannot ban yourself");
  }

  const updatedUser = await context.db.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(user)
      .set({
        banExpires: null,
        banReason: data.banned ? "No reason" : null,
        banned: data.banned,
      })
      .where(eq(user.id, data.userId))
      .returning({
        banned: user.banned,
        id: user.id,
      });

    if (updated && data.banned) {
      await transaction.delete(session).where(eq(session.userId, data.userId));
    }

    return updated;
  });

  if (!updatedUser) {
    throw new Error("User not found");
  }

  return {
    banned: updatedUser.banned ?? false,
    userId: updatedUser.id,
  };
}

// Mappers

function mapAdminUsersPage(
  users: AdminUserRow[],
  accountRows: AdminAccountRow[],
  hasNextPage: boolean,
  viewerUserId: string,
  totalUsers: number
) {
  const lastUser = users.at(-1);

  return {
    nextCursor:
      hasNextPage && lastUser
        ? encodeCursor({
            createdAt: lastUser.createdAtCursor,
            id: lastUser.id,
          })
        : null,
    totalUsers,
    users: mapAdminUsers(users, accountRows, viewerUserId),
  };
}

function mapAdminUsers(users: AdminUserRow[], accountRows: AdminAccountRow[], viewerUserId: string) {
  const providerIdsByUserId = new Map<string, string[]>();

  for (const accountRow of accountRows) {
    const providerIds = providerIdsByUserId.get(accountRow.userId) ?? [];
    if (!providerIds.includes(accountRow.providerId)) {
      providerIds.push(accountRow.providerId);
    }
    providerIdsByUserId.set(accountRow.userId, providerIds);
  }

  return users.map((userRow) => ({
    banned: userRow.banned ?? false,
    canBan: userRow.id !== viewerUserId,
    createdAt: userRow.createdAt,
    displayName: userRow.displayName ?? userRow.name,
    email: userRow.email,
    id: userRow.id,
    providerIds: providerIdsByUserId.get(userRow.id) ?? [],
    role: userRow.role,
    username: userRow.username,
  }));
}

// Cursors

function decodeAdminUsersCursor(cursor: string) {
  return decodeCursor(cursor, adminUsersCursorPayloadSchema, "Invalid admin users cursor");
}

function getAdminUsersCursorFilter(cursor: AdminUsersCursorPayload) {
  return sql`(
    ${user.createdAt}::text < ${cursor.createdAt}
    or (
      ${user.createdAt}::text = ${cursor.createdAt}
      and ${user.id} < ${cursor.id}
    )
  )`;
}

function getAdminUsersSearchFilter(query?: string) {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) return;

  const containsPattern = `%${trimmedQuery.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

  return or(
    ilike(user.username, containsPattern),
    ilike(user.displayUsername, containsPattern),
    ilike(user.name, containsPattern),
    ilike(user.email, containsPattern)
  );
}

// Counts

async function getAdminUserCount(
  context: AuthenticatedContext,
  searchFilter?: ReturnType<typeof getAdminUsersSearchFilter>
) {
  const [row] = await context.db
    .select({ total: count(user.id) })
    .from(user)
    .where(searchFilter);

  return row?.total ?? 0;
}
