import SpotifyWebApi from "spotify-web-api-node";
import { env } from "@/env";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const CLIENT_CREDENTIALS_CACHE_KEY = "spotify:client-credentials-token";
const CLOUDFLARE_WORKERS_MODULE = "cloudflare:workers";

interface ClientCredentialsToken {
  accessToken: string;
  expiresAt: number;
}

type CloudflareWorkersModule = typeof import("cloudflare:workers");

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
  const { body } = await spotifyApi.clientCredentialsGrant();

  const token = {
    accessToken: body.access_token,
    expiresAt: now + body.expires_in * 1000,
  };

  clientCredentialsToken = token;
  await setCachedClientCredentialsToken(token);

  return token.accessToken;
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
    console.warn("Failed to read Spotify token from KV", error);
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
    console.warn("Failed to write Spotify token to KV", error);
  }
}

async function getSpotifyCache() {
  if (!isCloudflareWorkersRuntime()) return null;

  try {
    const cloudflareWorkers: CloudflareWorkersModule = await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_MODULE);
    return cloudflareWorkers.env.CACHE;
  } catch (error) {
    console.warn("Failed to load Cloudflare Workers bindings", error);
    return null;
  }
}

function isCloudflareWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
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
