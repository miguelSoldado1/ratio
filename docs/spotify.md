# Spotify

## Attribution Rule

Any UI surface that displays metadata, artwork, previews, or other content fetched from Spotify must include Spotify attribution and link back to the relevant Spotify page where available.

Use an official Spotify logo asset as the minimum visible attribution for that surface, preferring the full logo where it fits and the icon where space or product clarity calls for a smaller mark. Do not scatter repeated logos across every row if one surface-level logo clearly covers the Spotify content being shown.

For item-level content such as search results, album pages, tracks, and feed cards, keep the mapped `spotifyUrl` available so users can open the applicable album, artist, track, or search result on Spotify.

## Spotify Login and Linking

Spotify is registered as a full social provider in Better Auth for sign-in. Every new Spotify sign-in and link additionally requests the `user-read-recently-played` scope, which powers the private recent-listening shelf on the homepage.

The scope stays in the default sign-in request on purpose:

- The consent cost of one mild scope on a music app is negligible.
- Opt-in-only would make the recent-listening shelf undiscoverable, because the homepage shows nothing to users who never granted it.
- A Spotify re-login that requests fewer scopes than previously granted produces a fresh refresh token that lacks the recently-played capability even though Better Auth's stored scope list still shows it granted. Keeping the scope in the default request keeps token capability and stored scopes in sync.

Existing Spotify accounts that predate the scope reauthorize from the homepage via `authClient.linkSocial({ provider: "spotify", scopes: [...] })`. Spotify returns the complete granted scope set on that OAuth pass and Better Auth stores it on the existing account; no unlink or additional sign-in provider is required.

Ratio pins Better Auth 1.6.23. The v1 compatibility invariant is that every Spotify scope the application relies on is included in the provider's default scope request. On 1.6.23, ordinary sign-in and `linkSocial` store the scope set returned by Spotify, while the standard `getAccessToken` refresh path preserves the stored value. Do not add an incremental scope that is omitted from later ordinary sign-ins. Upgrade to Better Auth 1.7 stable before introducing that pattern, because 1.7 unions previously granted scopes across later sign-ins and refreshes.

Future scopes stay out of the request until a shipped feature needs them: `user-top-read` (top tracks/artists) and `user-library-read` (Liked Songs).

## Personal Token Handling

Spotify user refresh tokens expire 6 months after the original authorization. Refreshing an access token does not extend this; only a full OAuth pass restarts the clock. Expired tokens return `400 invalid_grant` and must not be retried. Consequences:

- Every user-token grant dies at most 6 months after consent, so reconnection is a recurring mainline flow, not an edge case.
- Users who sign in to Ratio with Spotify renew the grant automatically on every sign-in, because sign-in requests the scope.
- Never revoke or expire a Ratio session because a Spotify token died. Sessions are identity; the Spotify link is an accessory to one feature.

Server code retrieves user tokens through `getSpotifyUserAccessToken` (`apps/web/src/server/spotify-user-token.ts`), which verifies the stored scope, then calls Better Auth's server `getAccessToken` API. Better Auth silently refreshes an expired access token exactly once. Token material never reaches the browser, and the database/auth work stays request-scoped.

Better Auth 1.6.23 sanitizes token-refresh failures into the same error, so Ratio cannot distinguish Spotify's permanent `invalid_grant` from a transient token-endpoint failure. The v1 policy intentionally maps any Better Auth token retrieval or refresh failure to reconnect-required. This keeps expiration recoverable without storing a separate authorization timestamp, at the accepted cost of an occasional unnecessary reconnect prompt during an outage. Ratio never adds a second token-refresh attempt. Spotify API responses that reject an otherwise retrieved token with `401` or `403` are also reconnect-required.

OAuth access and refresh tokens are encrypted at rest with Better Auth's `account.encryptOAuthTokens` option and
`BETTER_AUTH_SECRET`. The legacy plaintext production values were migrated after the encryption-aware application was
deployed; the one-off migration utility was removed after completion. New sign-ins, links, and token refreshes are
encrypted automatically. Keep the same `BETTER_AUTH_SECRET`; rotating it requires a separate decrypt-and-re-encrypt
plan for stored OAuth tokens.

Failures classify into conditions that drive different homepage UI:

```text
No Spotify account                                      → authorization-required
Missing scope, token retrieval/refresh failure, 401/403 → reconnect-required
Spotify rate limit                                      → rate-limited
Other upstream failure                                  → unavailable
```

The responsibility split between surfaces is deliberate:

- **Settings** owns linking and unlinking sign-in methods. It has no permission- or connection-health-specific Spotify UI.
- **The homepage** owns reauthorization. It derives its UI purely from the rotation endpoint's typed result status and never inspects accounts or scopes. A linked account with a missing permission, failed token retrieval or refresh, missing token material, or a token rejected by Spotify replaces the shelf with a single quiet inline "Reconnect Spotify" card. The action reauthorizes the existing account in place, and users without a linked Spotify account see nothing there.

## Recent Rotation (Recent-Listening Shelf)

A private homepage section, "Albums from your recent listening", visible only to the signed-in user — never on profiles, public feeds, notifications, or admin pages.

Pipeline in `apps/web/src/server/services/spotify-recent-rotation-service.ts`:

```text
Validate Spotify account, scope, and token (before any cached data is returned)
→ read per-user KV cache (spotify:recent-rotation:<ratio-user-id>, 30m TTL)
→ on miss: GET /me/player/recently-played?limit=50 (one request, album metadata included)
→ keep album_type === "album", drop local/malformed tracks
→ dedupe by album ID, keeping the newest played_at
→ order by most recent play, take 6
→ cache the normalized six-album response only
```

Rules:

- Listening history is never persisted in Postgres, and no permanent Ratio album rows are created from this shelf.
- Authorization failures are never cached as empty successful results; an empty album list is a valid successful result.
- Spotify `429` responses are respected without a retry loop. Better Auth refreshes once; Ratio does not add a retry around token retrieval.
- The client query uses a 30-minute `staleTime` matching the KV TTL. Known, accepted tradeoff: the two layers can compound to roughly 1-hour-old data in the worst case. No manual refresh in v1.
- The review feed loads independently; the shelf failing never breaks the feed.

## Client Credentials Token

Used for all catalog Spotify Web API requests (search, album details), for anonymous traffic and authenticated users alike. Only the recent-rotation shelf uses personal user tokens.

- Cache the token in Cloudflare KV with its expiry timestamp; optionally keep a module-scope in-memory copy as a fast per-isolate layer
- Refresh proactively before expiry; Spotify tokens last about 1 hour, so refresh around 55 minutes
- One token serves all anonymous traffic
- Protects against burning rate limit on public browsing

Cloudflare Workers do not give us one durable server process. Module-scope memory may survive across requests within a warm isolate, but it is not shared globally and can disappear at any time.

KV is the simplest durable shared cache for this token because the token is small, replaceable, and not user-specific. If KV is unavailable, regenerate the token from the Spotify client credentials and overwrite the cache.

## User Token

In use for the recent-rotation shelf (see Personal Token Handling above).

- Retrieved server-side via Better Auth `getAccessToken`
- Offloads rate limit from the server token significantly
- Currently used only for `recently-played`; `top-artists` and `saved-albums` remain out of scope

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
- Catalog requests intentionally omit Spotify's `market` parameter. Ratio prioritizes broad, deterministic album
  discovery over matching local playback availability, and one global result set lets anonymous and authenticated
  users share the same cache. Keep client-credentials tokens for catalog requests; personal user tokens would make
  results depend on the country associated with each Spotify account.
- Search, album details, and album-track pagination must use the same marketless catalog behavior. Their cache keys use
  an explicit versioned global scope so results from the former fixed-US behavior cannot be reused.
