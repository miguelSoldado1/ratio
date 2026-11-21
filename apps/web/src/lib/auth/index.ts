import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authProviderIds } from "@ratio/auth-providers";
import * as schema from "@ratio/database/schema";
import { APIError, betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, eq, isNotNull } from "drizzle-orm";
import { env } from "@/env";
import { isUsernameAllowed } from "@/lib/users/username-policy.server";
import { normalizeUsername } from "@/lib/users/username-policy.shared";
import { deleteImageObjects } from "@/server/image-storage";
import { createBetterAuthRateLimitStorage } from "@/server/rate-limit";
import { tryCatch } from "@/try-catch";
import { getDb } from "../db";
import { limitDisplayUsername, trimDisplayUsername } from "./profile-identity";
import { getAllowedDisplayUsername, isDisplayUsernameAllowed } from "./profile-identity.server";
import { SPOTIFY_RECENTLY_PLAYED_SCOPE } from "./spotify-scopes";
import type { Db } from "../db";

export function createAuth(db: Db) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      freshAge: 0,
    },
    rateLimit: {
      customRules: {
        "/callback/*": { max: 30, window: 60 },
        "/get-session": false,
        "/sign-in/social": { max: 20, window: 60 },
      },
      customStorage: createBetterAuthRateLimitStorage(),
      enabled: true,
      max: 100,
      window: 60,
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
    user: {
      additionalFields: {
        avatarObjectKey: {
          input: false,
          required: false,
          returned: false,
          type: "string",
        },
      },
      deleteUser: {
        beforeDelete: async (deletedUser) => {
          const [[currentUser], listCovers] = await Promise.all([
            db
              .select({ avatarObjectKey: schema.user.avatarObjectKey })
              .from(schema.user)
              .where(eq(schema.user.id, deletedUser.id))
              .limit(1),
            db
              .select({ coverObjectKey: schema.lists.coverObjectKey })
              .from(schema.lists)
              .where(and(eq(schema.lists.userId, deletedUser.id), isNotNull(schema.lists.coverObjectKey))),
          ]);

          const objectKeys = [currentUser?.avatarObjectKey, ...listCovers.map((list) => list.coverObjectKey)].filter(
            (objectKey): objectKey is string => Boolean(objectKey)
          );

          if (objectKeys.length === 0) return;

          const { data, error } = await tryCatch(deleteImageObjects(objectKeys));
          if (error || data.failedKeys.length > 0) {
            console.warn("Failed to delete image objects during account deletion", error ?? data.failedKeys);
          }
        },
        enabled: true,
      },
    },
    databaseHooks: {
      user: {
        update: {
          before: (data, context) => {
            if (context?.path !== "/update-user") return Promise.resolve();

            if (data.image !== undefined || "avatarObjectKey" in data) {
              throw new APIError("BAD_REQUEST", {
                message: "Profile photo must be updated through avatar upload.",
              });
            }

            return Promise.resolve();
          },
        },
      },
    },
    account: {
      accountLinking: {
        trustedProviders: authProviderIds,
        disableImplicitLinking: true,
      },
      encryptOAuthTokens: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        mapProfileToUser: async (profile) => {
          const baseUsername = profile.email
            ? profile.email.split("@")[0].toLowerCase()
            : `user_${profile.sub.slice(-8)}`;
          const finalUsername = await generateUniqueUsername(db, baseUsername);

          return {
            username: finalUsername,
            displayUsername: getAllowedDisplayUsername(
              limitDisplayUsername(profile.name || profile.given_name || baseUsername)
            ),
          };
        },
      },
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        mapProfileToUser: async (profile) => {
          const baseUsername = profile.username || `user_${profile.id.slice(-8)}`;
          const finalUsername = await generateUniqueUsername(db, baseUsername);

          return {
            username: finalUsername,
            displayUsername: getAllowedDisplayUsername(
              limitDisplayUsername(profile.global_name || profile.username || baseUsername)
            ),
          };
        },
      },
      spotify: {
        clientId: env.SPOTIFY_CLIENT_ID,
        clientSecret: env.SPOTIFY_CLIENT_SECRET,
        scope: [SPOTIFY_RECENTLY_PLAYED_SCOPE],
        mapProfileToUser: async (profile) => {
          const displayName = profile.display_name?.trim() ?? "";
          const baseUsername = displayName.toLowerCase().replace(/\s+/g, "_") || `user_${profile.id.slice(-8)}`;
          const finalUsername = await generateUniqueUsername(db, baseUsername);

          return {
            username: finalUsername,
            displayUsername: getAllowedDisplayUsername(limitDisplayUsername(displayName || baseUsername)),
          };
        },
      },
    },
    plugins: [
      username({
        displayUsernameNormalization: trimDisplayUsername,
        displayUsernameValidator: isDisplayUsernameAllowed,
        usernameNormalization: normalizeUsername,
        usernameValidator: isUsernameAllowed,
        validationOrder: { username: "post-normalization" },
      }),
      admin(),
      tanstackStartCookies(),
    ],
  });
}

export async function handleAuthRequest(request: Request) {
  const db = await getDb();
  const auth = createAuth(db);

  return await auth.handler(request);
}

async function generateUniqueUsername(db: Db, baseUsername: string): Promise<string> {
  const normalizedUsername = normalizeProviderUsername(baseUsername);
  const usernameBase = isUsernameAllowed(normalizedUsername) ? normalizedUsername : "user";

  if (await isUsernameAvailable(db, usernameBase)) {
    return usernameBase;
  }

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const hash = Math.random().toString(36).slice(2, 6);
    const usernameWithHash = `${usernameBase.slice(0, 25)}_${hash}`;

    if (await isUsernameAvailable(db, usernameWithHash)) {
      return usernameWithHash;
    }
  }

  return `user_${Date.now().toString(36)}`;
}

async function isUsernameAvailable(db: Db, candidate: string) {
  if (!isUsernameAllowed(candidate)) {
    return false;
  }

  const existingUser = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, candidate))
    .limit(1)
    .catch(() => [{ id: candidate }]);

  return existingUser.length === 0;
}

function normalizeProviderUsername(candidate: string) {
  const normalizedUsername = candidate
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.]+/g, "_")
    .replace(/[_.]{2,}/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "");

  return normalizedUsername.length >= 3 ? normalizedUsername.slice(0, 30) : "user";
}
