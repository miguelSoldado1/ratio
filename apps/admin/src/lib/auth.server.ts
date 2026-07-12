import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import * as schema from "@ratio/database/schema";
import { betterAuth } from "better-auth";
import { admin, lastLoginMethod, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { adminAuthUrl, env } from "@/env";
import { getDb } from "./db";
import type { Db } from "@ratio/database";

const spotifyRecentlyPlayedScope = "user-read-recently-played";

export function createAdminAuth(db: Db) {
  return betterAuth({
    baseURL: adminAuthUrl,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: false, disableSignUp: true },
    account: {
      encryptOAuthTokens: true,
    },
    advanced: {
      cookiePrefix: "ratio-admin",
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: adminAuthUrl.startsWith("https://"),
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async () => false,
        },
      },
    },
    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        disableSignUp: true,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        disableSignUp: true,
      },
      spotify: {
        clientId: env.SPOTIFY_CLIENT_ID,
        clientSecret: env.SPOTIFY_CLIENT_SECRET,
        disableSignUp: true,
        scope: [spotifyRecentlyPlayedScope],
      },
    },
    plugins: [username(), lastLoginMethod(), admin(), tanstackStartCookies()],
  });
}

export async function handleAdminAuthRequest(request: Request) {
  const auth = createAdminAuth(await getDb());
  return await auth.handler(request);
}
