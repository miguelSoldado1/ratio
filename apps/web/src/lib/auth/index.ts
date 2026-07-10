import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import * as schema from "@ratio/database/schema";
import { APIError, betterAuth } from "better-auth";
import { admin, lastLoginMethod, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { isUsernameAllowed } from "@/lib/users/username-policy.server";
import { normalizeUsername } from "@/lib/users/username-policy.shared";
import { deleteAvatarObject } from "@/server/avatar-storage";
import { createBetterAuthRateLimitStorage } from "@/server/rate-limit";
import { clearSpotifyRecentRotationCacheForDeletedAccount } from "@/server/spotify-recent-rotation-cache";
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
      // Ratio is OAuth-only, so there is no password challenge that can refresh
      // Better Auth's sensitive-action freshness window after it expires.
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
          const [currentUser] = await db
            .select({ avatarObjectKey: schema.user.avatarObjectKey })
            .from(schema.user)
            .where(eq(schema.user.id, deletedUser.id))
            .limit(1);

          if (!currentUser?.avatarObjectKey) return;

          try {
            await deleteAvatarObject(currentUser.avatarObjectKey);
          } catch (error) {
            console.warn("Failed to delete avatar object during account deletion", error);
          }
        },
        enabled: true,
      },
    },
    databaseHooks: {
      account: {
        delete: {
          after: clearSpotifyRecentRotationCacheForDeletedAccount,
        },
      },
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
        trustedProviders: ["spotify", "google", "discord"],
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
          const baseUsername = profile.display_name.toLowerCase().replace(/\s+/g, "_") || "user";
          const finalUsername = await generateUniqueUsername(db, baseUsername);

          return {
            username: finalUsername,
            displayUsername: getAllowedDisplayUsername(limitDisplayUsername(profile.display_name || baseUsername)),
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
      lastLoginMethod(),
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
