import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url().optional(),
    ADMIN_BETTER_AUTH_URL: z.url().optional(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    SPOTIFY_CLIENT_ID: z.string().min(1),
    SPOTIFY_CLIENT_SECRET: z.string().min(1),
  },
  clientPrefix: "VITE_",
  client: {},
  runtimeEnv: process.env,
});

export const adminAuthUrl = env.ADMIN_BETTER_AUTH_URL ?? env.BETTER_AUTH_URL;
