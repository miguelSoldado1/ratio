# Ratio — Implementation Plan

> Letterboxd for albums. Built on TanStack Start, Cloudflare Workers, Supabase (Postgres), Drizzle, and Better Auth.

---

## Core Concept

Ratio lets anyone browse and discover albums without an account. Authenticated users can rate, review, like, and follow others. Spotify is one of several login providers — not a requirement — but linking it unlocks a personalised feed based on listening history.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | TanStack Start | Currently wired through the TanStack Start Vite plugin |
| Deployment | Cloudflare Workers | Target deployment; Cloudflare adapter/config is not wired yet |
| Database | Supabase (Postgres) | No Supabase SDK needed; validate Worker-compatible Postgres connectivity before feature work |
| ORM | Drizzle | Postgres dialect |
| Auth | Better Auth (self-hosted) | Username + last-login-method plugins already wired |
| Music data | Spotify Web API | Client Credentials (anonymous) + user token (linked) |

---

## Authentication

### Providers

No email/password. OAuth only — removing the email flow eliminates forgotten password infrastructure entirely.

| Provider | Purpose |
|---|---|
| Spotify | Login or account link |

Additional OAuth providers are still an open product decision.

### Auth Tiers

```
Anonymous
  └── Can browse albums, read reviews, see ratings
  └── Spotify API via server Client Credentials token

Authenticated (any provider)
  └── Can rate, review, like, follow, manage lists
  └── Spotify API still via server token unless Spotify is linked

Authenticated + Spotify linked
  └── Personalised feed from listening history & top artists
  └── Spotify API calls use their personal access token
  └── Server token preserved for anonymous traffic
```

### Spotify as Login vs. Link

Spotify is registered as a full social provider in Better Auth. Whether the user **signs in** with Spotify or **links** it later, the access and refresh tokens are stored identically on the `account` table. The retrieval call is the same either way:

```ts
const { data } = await authClient.getAccessToken({ providerId: "spotify" })
const accessToken = data?.accessToken
```

This means a user who signs in with another OAuth provider and later links Spotify will have a valid token available on any device they sign into — tokens are stored against the user record, not the session or device.

### Token Refresh

Configure the Spotify provider with refresh enabled. Better Auth handles silent refresh automatically. Guard all token retrieval in case the refresh token has been invalidated (user revoked access in Spotify settings):

```ts
async function getSpotifyToken(userId?: string): Promise<string> {
  if (userId) {
    try {
      const { data } = await authClient.getAccessToken({ providerId: "spotify" })
      if (data?.accessToken) return data.accessToken
    } catch {
      // Token revoked or expired beyond refresh — fall through
      // Optionally: flag user to reconnect Spotify in settings
    }
  }
  return getClientCredentialsToken() // server-side fallback
}
```

In server code, retrieve linked-provider tokens through Better Auth's server API using the current session/user context. Do not depend on browser-only auth client state for Worker-side Spotify calls.

---

## Spotify API Strategy

### Attribution Rule

Any UI surface that displays metadata, artwork, previews, or other content fetched from Spotify must include Spotify attribution and link back to the relevant Spotify page where available. Use an official Spotify logo asset as the minimum visible attribution for that surface, preferring the full logo where it fits and the icon where space or product clarity calls for a smaller mark. Do not scatter repeated logos across every row if one surface-level logo clearly covers the Spotify content being shown. For item-level content such as search results, album pages, tracks, and feed cards, keep the mapped `spotifyUrl` available so users can open the applicable album, artist, track, or search result on Spotify.

### Client Credentials (server token)

Used for all anonymous requests and as fallback for authenticated users without Spotify linked.

- Cache the token in Cloudflare KV with its expiry timestamp; optionally keep a module-scope in-memory copy as a fast per-isolate layer
- Refresh proactively before expiry (Spotify tokens last about 1 hour, refresh around 55 minutes)
- One token serves all anonymous traffic
- Protects against burning rate limit on public browsing

Cloudflare Workers do not give us one durable server process. Module-scope memory may survive across requests within a warm isolate, but it is not shared globally and can disappear at any time. KV is the simplest durable shared cache for this token because the token is small, replaceable, and not user-specific. If KV is unavailable, regenerate the token from the Spotify client credentials and overwrite the cache.

### User Token (personal token)

Used for authenticated users with Spotify linked.

- Retrieved via Better Auth `getAccessToken`
- Offloads rate limit from the server token significantly
- Enables personalised endpoints: `top-artists`, `recently-played`, `saved-albums`

### Album Data Caching

Store Spotify album metadata in our own `albums` table after the first time an album enters the product surface through search, an album page, a rating, a list, or a feed item. Do not bulk-import Spotify; cache only albums that users or app features actually touch.

The main reason to store album records is product correctness, not just performance:
- Ratings, reviews, likes, lists, feeds, and activity need a stable local `albumId` to reference.
- Album pages should keep rendering even if Spotify changes availability, removes an album, or rate limits us.
- Community aggregates such as average score, rating count, trending, and list membership need local joins.
- Search can still use Spotify live, but selected results should be persisted before users rate, review, or save them.

Spotify remains the source of truth for discovery and fresh lookup. Our database stores the subset of albums Ratio has interacted with.

### Search

Search is the most token-expensive endpoint.

- Debounce on the client (300–500ms)
- Filter Spotify search results to albums only
- Cache common or repeated queries server-side with a short TTL
- Deduplicate in-flight requests

---

## Database Schema

The current repo defines the Better Auth tables directly in `src/lib/auth/auth-schema.ts`, and `src/lib/db/schema.ts` re-exports that file as the Drizzle schema entrypoint. Add app-level tables to the exported schema entrypoint so `drizzle-kit` can generate one coherent migration set.

Cloudflare Worker compatibility is the riskiest database integration. The current local DB client uses `postgres`, which may need to be replaced or wrapped with a Worker-compatible Postgres connection path such as Cloudflare Hyperdrive or another supported driver. Validate this with a deployed Worker test query before building app features on top.

Deployment note from the initial Cloudflare rollout: a module-scoped `postgres` client failed in Workers during OAuth callback handling with `Cannot perform I/O on behalf of a different request`, surfaced by Better Auth as a failed `verification` query while parsing OAuth state. The current mitigation is to create and close the `postgres` client per auth request and to use `prepare: false` for the Supabase transaction pooler on port `6543`. If DB usage expands beyond auth, revisit this before adding shared module-level DB clients. Cloudflare Hyperdrive is a likely production-grade fix because it provides a Worker-native Postgres binding/connection proxy; another option is moving to an edge-compatible HTTP driver where possible.

```ts
// albums — cached Spotify metadata
export const albums = pgTable("albums", {
  id: text("id").primaryKey(),               // Spotify album ID
  name: text("name").notNull(),
  artistName: text("artist_name").notNull(),
  artistIds: text("artist_ids").array(),     // for feed personalisation joins
  coverUrl: text("cover_url"),
  releaseDate: text("release_date"),
  albumType: text("album_type"),             // keep Spotify's value; product filters to album
  spotifyUrl: text("spotify_url"),
  cachedAt: timestamp("cached_at").defaultNow(),
  removed: boolean("removed").default(false), // Spotify delisted flag
})

// ratings — one per user per album, score + optional review
export const ratings = pgTable("ratings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  albumId: text("album_id").notNull().references(() => albums.id),
  score: numeric("score", { precision: 3, scale: 1 }).notNull(), // 0.0–10.0
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.albumId),   // enforced at DB level
}))

// likes — on ratings, not albums
export const likes = pgTable("likes", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  ratingId: uuid("rating_id").notNull().references(() => ratings.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.ratingId] }),
}))

// follows — user graph
export const follows = pgTable("follows", {
  followerId: text("follower_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followerId, t.followingId] }),
}))

// lists — user-curated album collections
export const lists = pgTable("lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  ranked: boolean("ranked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const listItems = pgTable("list_items", {
  listId: uuid("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  albumId: text("album_id").notNull().references(() => albums.id),
  position: integer("position"),            // null if unranked
  note: text("note"),
}, (t) => ({
  pk: primaryKey({ columns: [t.listId, t.albumId] }),
}))
```

---

## Feed Algorithm

### Cold start (no Spotify linked)

No personalisation signal available. Show:

1. Recent ratings from people the user follows (if authenticated)
2. Trending albums this week (most ratings/likes in rolling 7-day window)
3. Highly rated recent releases

### Warm feed (Spotify linked)

Pull from Spotify:
- `me/top/artists` — long and medium term
- `me/player/recently-played` — last 50 tracks (deduplicated to unique albums)
- `me/albums` — saved library

Surface albums from those artists that have community activity on Ratio. Blend with social feed (people they follow).

**Decay and variety rules:**
- Cap per-artist representation in a single feed load (e.g. max 2 albums per artist)
- Apply recency decay on `recently-played` — binge-listening one artist shouldn't flood the feed
- If `recently-played` is thin (inactive Spotify user), fall back to `top-artists` only

### Rating display

Use a Bayesian average to prevent low-sample-count albums showing extreme scores:

```
bayesian_score = (global_mean * min_votes + sum_of_ratings) / (min_votes + vote_count)
```

Set `min_votes` to something like 5. Tune `global_mean` from your actual data over time. Show raw average alongside vote count once the album has enough ratings.

---

## Routes

Route files should prefer TanStack Router's folder-style organization for nested/path segments, e.g. `src/routes/album/$albumId.tsx` for `/album/:albumId`, instead of flattened names such as `album.$albumId.tsx`.

```
/                          Public feed — trending + recent activity
/album/:spotifyId          Album page — metadata, community rating, reviews
/user/:username            Profile — ratings, reviews, lists, followers
/search                    Search albums via Spotify API
/feed                      Personalised feed (auth required)
/lists/:id                 Public list view
/settings                  Account settings, linked providers, Spotify connect
```

All album pages (`/album/:spotifyId`) are publicly accessible and shareable. These are the canonical indexable pages.

---

## Features

- Browse albums without account
- Rate albums 0–10 (auth required)
- Optional written review alongside rating
- Like reviews
- Follow users
- User profiles with rating history
- Album pages with community score and reviews
- Search (Spotify API)
- Link/unlink Spotify in settings
- Personalised feed for users with Spotify linked
- Lists — curated ranked or unranked album collections
- Activity feed — "X rated Y", "X followed Z" social activity
- Diary — chronological log of what a user has rated and when
- Popular this week — rolling aggregation for the anonymous feed
- Notifications — someone liked your review, new follower

---

## Product Design Rules

- Keep the app quiet, dense, and content-led. Ratio should feel closer to a focused music library than a marketing page.
- Use the existing typography system and shared UI primitives first. Avoid local font changes or broad shadcn component changes unless the design system itself is being intentionally updated.
- Hover should imply action. Add hover states to links, buttons, icon buttons, tabs, and fully clickable cards; keep static rows, metadata, and read-only content visually still.
- If only part of a card is interactive, make only that control react. Do not add full-card hover unless clicking the card itself has a clear destination.
- Motion should explain state or provide feedback. Frequent interactions should be instant or very subtle; avoid decorative animation on surfaces users scan repeatedly.
- Prefer fine-pointer-only hover treatments where relevant so touch layouts do not inherit desktop affordances.
- Use subdued metadata hierarchy. Secondary facts should be available but visually quiet, and repeated labels should be removed when nearby context already explains the content.
- Empty states should preserve the layout and communicate the absence clearly without turning into a separate promotional panel.
- Keep visual references to Spotify as mood and interaction inspiration, not direct imitation.
- When a surface uses Spotify-fetched content, include the required Spotify logo attribution in the quietest viable placement and avoid unnecessary repeated logos.

---

## Edge Cases

| Case | Handling |
|---|---|
| Album removed from Spotify | Keep cached metadata, set `removed = true`, hide "Open in Spotify" link |
| Spotify refresh token revoked | Catch error from `getAccessToken`, fall back to client credentials, surface soft reconnect prompt in settings |
| Duplicate rating attempt | Enforced at DB level via unique constraint on `(userId, albumId)` — upsert on re-submit |
| Low vote count rating display | Bayesian average until threshold is met, show raw score + count after |
| Empty social feed (new user) | Fall back to trending feed until they follow someone; suggest popular users to follow on signup |
| `recently-played` too thin | Fall back to `top-artists` for feed seeding; no error state shown to user |
| Compilation / single vs album | Filter search and product surfaces to albums only; keep `albumType` from Spotify for defensive checks |
| User signs in on new device | Spotify tokens stored on user record, not session — available immediately after login on any device |
| Self-follow attempt | Guard in the follow/unfollow endpoint |

---

## Build Order

Work in this sequence to validate the riskiest integrations first before building features on top.

```
1. TanStack Start app baseline — already present locally
2. Cloudflare adapter/config — deploy hello world
3. Supabase connection + Drizzle — connect from Worker, run a test query
4. Better Auth — confirm existing setup works end to end in Worker context
5. Spotify Client Credentials — server token, fetch a public album, render it
6. Album page /album/:spotifyId — metadata, fully public, no auth required
7. Search — Spotify search API, debounced, cached
8. Auth UI — Spotify plus selected OAuth providers; account linking in `/settings`
9. Rating flow — score input, DB write, display on album page
10. Spotify account linking — retrieve token, confirm feed upgrade
11. Feed — popular first, then personalised once Spotify linking is in
12. User profiles — rating history, follow graph
13. Likes + social activity
```

---

## Open Decisions

- **Additional OAuth providers** — Spotify is required for login/linking; decide which other providers belong in the product.
- **Rating edit policy** — can users update their rating after submitting? If so, surface the updated timestamp.
- **Review character limit** — set one early to avoid DB and UI surprises later.
- **Spotify reconnect UX** — soft prompt in feed/settings, or hard gate on personalised features?
