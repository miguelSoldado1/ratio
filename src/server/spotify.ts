import SpotifyWebApi from "spotify-web-api-node";
import { env } from "@/env";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

let clientCredentialsToken: { accessToken: string; expiresAt: number } | null = null;

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

  if (clientCredentialsToken && clientCredentialsToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    return clientCredentialsToken.accessToken;
  }

  const spotifyApi = createSpotifyApi();
  const { body } = await spotifyApi.clientCredentialsGrant();

  clientCredentialsToken = {
    accessToken: body.access_token,
    expiresAt: now + body.expires_in * 1000,
  };

  return clientCredentialsToken.accessToken;
}
