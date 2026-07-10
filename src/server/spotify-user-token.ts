import { and, eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import { hasSpotifyRecentlyPlayedScope } from "@/lib/auth/spotify-scopes";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";

const SPOTIFY_PROVIDER_ID = "spotify";

export class SpotifyAuthorizationRequiredError extends Error {
  constructor() {
    super("Spotify authorization has not been granted");
    this.name = "SpotifyAuthorizationRequiredError";
  }
}

export class SpotifyReconnectRequiredError extends Error {
  constructor(cause?: unknown) {
    super("Spotify connection needs to be re-authorized", { cause });
    this.name = "SpotifyReconnectRequiredError";
  }
}

export async function getSpotifyUserAccessToken(db: Db, userId: string): Promise<string> {
  const [spotifyAccount] = await db
    .select({ accountId: schema.account.accountId, scope: schema.account.scope })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, SPOTIFY_PROVIDER_ID)))
    .limit(1);

  if (!spotifyAccount) {
    throw new SpotifyAuthorizationRequiredError();
  }

  if (!hasSpotifyRecentlyPlayedScope(spotifyAccount.scope)) throw new SpotifyReconnectRequiredError();

  const auth = createAuth(db);

  let accessToken: string;
  try {
    ({ accessToken } = await auth.api.getAccessToken({
      body: {
        accountId: spotifyAccount.accountId,
        providerId: SPOTIFY_PROVIDER_ID,
        userId,
      },
    }));
  } catch (error) {
    throw new SpotifyReconnectRequiredError(error);
  }

  if (!accessToken) {
    throw new SpotifyReconnectRequiredError();
  }

  return accessToken;
}
