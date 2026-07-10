import SpotifyWebApi from "spotify-web-api-node";
import { env } from "@/env";
import { getSpotifyCache } from "./spotify-cache";
import { logSpotifyCacheError, logSpotifyTokenError, SpotifyTokenError } from "./spotify-observability";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const CLIENT_CREDENTIALS_CACHE_KEY = "spotify:client-credentials-token";

interface ClientCredentialsToken {
  accessToken: string;
  expiresAt: number;
}

let clientCredentialsToken: ClientCredentialsToken | null = null;

export function createSpotifyApi(accessToken?: string) {
  const spotifyApi = new SpotifyWebApi({
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
  });

  if (accessToken) {
    spotifyApi.setAccessToken(accessToken);
  }

  return spotifyApi;
}

export async function getClientCredentialsToken() {
  const now = Date.now();
  const cachedToken = await getCachedClientCredentialsToken(now);

  if (cachedToken) {
    return cachedToken.accessToken;
  }

  const spotifyApi = createSpotifyApi();
  const body = await getClientCredentialsGrantBody(spotifyApi);

  const token = {
    accessToken: body.access_token,
    expiresAt: now + body.expires_in * 1000,
  };

  clientCredentialsToken = token;
  await setCachedClientCredentialsToken(token);

  return token.accessToken;
}

async function getClientCredentialsGrantBody(spotifyApi: SpotifyWebApi) {
  try {
    const { body } = await spotifyApi.clientCredentialsGrant();
    return body;
  } catch (error) {
    logSpotifyTokenError("client_credentials_grant", error);
    throw new SpotifyTokenError(error);
  }
}

async function getCachedClientCredentialsToken(now: number) {
  if (isFreshToken(clientCredentialsToken, now)) {
    return clientCredentialsToken;
  }

  const spotifyCache = await getSpotifyCache();
  if (!spotifyCache) return null;

  try {
    const cachedToken = await spotifyCache.get<unknown>(CLIENT_CREDENTIALS_CACHE_KEY, "json");
    const token = parseClientCredentialsToken(cachedToken);

    if (isFreshToken(token, now)) {
      clientCredentialsToken = token;
      return token;
    }
  } catch (error) {
    logSpotifyCacheError("read_token", error);
  }

  return null;
}

async function setCachedClientCredentialsToken(token: ClientCredentialsToken) {
  const spotifyCache = await getSpotifyCache();
  if (!spotifyCache) return;

  try {
    await spotifyCache.put(CLIENT_CREDENTIALS_CACHE_KEY, JSON.stringify(token), {
      expirationTtl: Math.max(60, Math.floor((token.expiresAt - Date.now()) / 1000)),
    });
  } catch (error) {
    logSpotifyCacheError("write_token", error);
  }
}

function isFreshToken(token: ClientCredentialsToken | null, now: number) {
  return token !== null && token.expiresAt - TOKEN_REFRESH_BUFFER_MS > now;
}

function parseClientCredentialsToken(value: unknown): ClientCredentialsToken | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("accessToken" in value && "expiresAt" in value)) return null;

  const { accessToken, expiresAt } = value;
  if (typeof accessToken !== "string") return null;
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return null;

  return { accessToken, expiresAt };
}
