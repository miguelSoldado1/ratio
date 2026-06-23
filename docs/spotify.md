# Spotify

## Attribution Rule

Any UI surface that displays metadata, artwork, previews, or other content fetched from Spotify must include Spotify attribution and link back to the relevant Spotify page where available.

Use an official Spotify logo asset as the minimum visible attribution for that surface, preferring the full logo where it fits and the icon where space or product clarity calls for a smaller mark. Do not scatter repeated logos across every row if one surface-level logo clearly covers the Spotify content being shown.

For item-level content such as search results, album pages, tracks, and feed cards, keep the mapped `spotifyUrl` available so users can open the applicable album, artist, track, or search result on Spotify.

## Spotify as Login vs. Link

Spotify is registered as a full social provider in Better Auth. Whether the user signs in with Spotify or links it later, the access and refresh tokens are stored identically on the `account` table.

The retrieval call is the same either way:

```ts
const { data } = await authClient.getAccessToken({ providerId: "spotify" })
const accessToken = data?.accessToken
```

This means a user who signs in with another OAuth provider and later links Spotify will have a valid token available on any device they sign into. Tokens are stored against the user record, not the session or device.

## Token Refresh

Configure the Spotify provider with refresh enabled. Better Auth handles silent refresh automatically. Guard all token retrieval in case the refresh token has been invalidated, such as when a user revokes access in Spotify settings.

```ts
async function getSpotifyToken(userId?: string): Promise<string> {
  if (userId) {
    try {
      const { data } = await authClient.getAccessToken({ providerId: "spotify" })
      if (data?.accessToken) return data.accessToken
    } catch {
      // Token revoked or expired beyond refresh; fall through.
      // Optionally flag user to reconnect Spotify in settings.
    }
  }
  return getClientCredentialsToken()
}
```

In server code, retrieve linked-provider tokens through Better Auth's server API using the current session/user context. Do not depend on browser-only auth client state for Worker-side Spotify calls.

## Client Credentials Token

Used for all anonymous requests and as fallback for authenticated users without Spotify linked.

- Cache the token in Cloudflare KV with its expiry timestamp; optionally keep a module-scope in-memory copy as a fast per-isolate layer
- Refresh proactively before expiry; Spotify tokens last about 1 hour, so refresh around 55 minutes
- One token serves all anonymous traffic
- Protects against burning rate limit on public browsing

Cloudflare Workers do not give us one durable server process. Module-scope memory may survive across requests within a warm isolate, but it is not shared globally and can disappear at any time.

KV is the simplest durable shared cache for this token because the token is small, replaceable, and not user-specific. If KV is unavailable, regenerate the token from the Spotify client credentials and overwrite the cache.

## User Token

Used for authenticated users with Spotify linked.

- Retrieved via Better Auth `getAccessToken`
- Offloads rate limit from the server token significantly
- Enables personalised endpoints: `top-artists`, `recently-played`, `saved-albums`

## Album Data Caching

Store Spotify album metadata in our own `album` table only after a meaningful write action brings that album into Ratio's durable product graph. The initial write action is creating a rating/review; future write actions may include adding an album to a list or saving it.

Do not persist albums just because they appear in search results, an album page view, or casual browsing. Do not bulk-import Spotify.

The main reason to store album records is product correctness, not just performance:

- Ratings, reviews, likes, lists, feeds, and activity need a stable local `albumId` to reference.
- Feeds, profiles, lists, notifications, and other local product surfaces should be able to render touched albums even if Spotify changes availability, removes an album, or rate limits us.
- Community aggregates such as average score, rating count, trending, and list membership need local joins.
- Search and album pages can still use Spotify live. Album rows are created by trusted server-side write flows before inserting local user data that references them.

Spotify remains the source of truth for discovery and fresh lookup. Our database stores the subset of albums Ratio has durable local activity for. Track lists are not stored in Postgres initially; album pages can fetch tracks live from Spotify or use a short-lived server-owned cache later if needed.

When creating the first review for an album, the client only submits the Spotify album ID plus review data. The server must ensure the album row exists before inserting the review: first check Postgres, then fetch the album from Spotify if missing, reject non-album Spotify IDs, then transactionally upsert the album and insert the review.

Do not trust client-provided album metadata for durable writes. If Spotify lookup fails and the album row does not already exist, reject the review with a user-friendly retry message rather than creating a review that points at a missing album. If duplicate first-write lookups become painful, add a short-lived Cloudflare KV cache written and read only by server-side Spotify lookup code.

## Search

Search is the most token-expensive endpoint.

- Debounce on the client: 300-500ms
- Filter Spotify search results to albums only
- Cache common or repeated queries server-side with a short TTL
- Deduplicate in-flight requests
