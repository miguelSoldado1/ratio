import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError, betterAuth } from "better-auth";
import { lastLoginMethod, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { deleteAvatarObject } from "@/server/avatar-storage";
import { getDb } from "../db";
import * as schema from "../db/schema";
import { isDisplayUsernameValid, limitDisplayUsername, trimDisplayUsername } from "./profile-identity";
import type { Db } from "../db";

export function createAuth(db: Db) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: false },
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
            displayUsername: limitDisplayUsername(profile.name || profile.given_name || baseUsername),
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
            displayUsername: limitDisplayUsername(profile.global_name || profile.username || baseUsername),
          };
        },
      },
      spotify: {
        clientId: env.SPOTIFY_CLIENT_ID,
        clientSecret: env.SPOTIFY_CLIENT_SECRET,
        mapProfileToUser: async (profile) => {
          const baseUsername = profile.display_name.toLowerCase().replace(/\s+/g, "_") || "user";
          const finalUsername = await generateUniqueUsername(db, baseUsername);

          return {
            username: finalUsername,
            displayUsername: limitDisplayUsername(profile.display_name || baseUsername),
          };
        },
      },
    },
    plugins: [
      username({
        displayUsernameNormalization: trimDisplayUsername,
        displayUsernameValidator: isDisplayUsernameValid,
      }),
      lastLoginMethod(),
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
  const normalizedUsername = normalizeUsername(baseUsername);

  if (await isUsernameAvailable(db, normalizedUsername)) {
    return normalizedUsername;
  }

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const hash = Math.random().toString(36).slice(2, 6);
    const usernameWithHash = `${normalizedUsername.slice(0, 25)}_${hash}`;

    if (await isUsernameAvailable(db, usernameWithHash)) {
      return usernameWithHash;
    }
  }

  return `${normalizedUsername.slice(0, 20)}_${Date.now().toString(36)}`;
}

async function isUsernameAvailable(db: Db, candidate: string) {
  const existingUser = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, candidate))
    .limit(1)
    .catch(() => [{ id: candidate }]);

  return existingUser.length === 0;
}

function normalizeUsername(candidate: string) {
  const normalizedUsername = candidate
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.]+/g, "_")
    .replace(/[_.]{2,}/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "");

  return normalizedUsername.length >= 3 ? normalizedUsername.slice(0, 30) : "user";
}
