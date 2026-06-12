import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { lastLoginMethod, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: false },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  account: {
    accountLinking: {
      trustedProviders: ["spotify"],
      disableImplicitLinking: true,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      mapProfileToUser: async (profile) => {
        const baseUsername = profile.email
          ? profile.email.split("@")[0].toLowerCase()
          : `user_${profile.sub.slice(-8)}`;
        const finalUsername = await generateUniqueUsername(baseUsername);

        return {
          username: finalUsername,
          displayUsername: profile.name || profile.given_name,
        };
      },
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
      mapProfileToUser: async (profile) => {
        const baseUsername = profile.email
          ? profile.email.split("@")[0].toLowerCase()
          : `user_${profile.sub.slice(-8)}`;
        const finalUsername = await generateUniqueUsername(baseUsername);

        return {
          username: finalUsername,
          displayUsername: profile.name || profile.email,
        };
      },
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      mapProfileToUser: async (profile) => {
        const baseUsername = profile.display_name.toLowerCase().replace(/\s+/g, "_") || "user";
        const finalUsername = await generateUniqueUsername(baseUsername);

        return {
          username: finalUsername,
          displayUsername: profile.display_name,
        };
      },
    },
  },
  plugins: [username(), lastLoginMethod(), tanstackStartCookies()],
});

async function generateUniqueUsername(baseUsername: string): Promise<string> {
  const normalizedUsername = normalizeUsername(baseUsername);

  if (await isUsernameAvailable(normalizedUsername)) {
    return normalizedUsername;
  }

  for (let attempts = 0; attempts < 5; attempts += 1) {
    const hash = Math.random().toString(36).slice(2, 6);
    const usernameWithHash = `${normalizedUsername.slice(0, 25)}_${hash}`;

    if (await isUsernameAvailable(usernameWithHash)) {
      return usernameWithHash;
    }
  }

  return `${normalizedUsername.slice(0, 20)}_${Date.now().toString(36)}`;
}

async function isUsernameAvailable(candidate: string) {
  const result = await auth.api
    .isUsernameAvailable({
      body: { username: candidate },
    })
    .catch(() => ({ available: false }));

  return result.available;
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
