# Product

> Ratio is Letterboxd for albums: a quiet, dense, content-led music library for browsing, rating, reviewing, and discovering albums.

## Core Concept

Ratio lets anyone browse and discover albums without an account. Authenticated users can rate, review, like, and follow others. Spotify is one of several login providers, not a requirement, but linking it unlocks a personalised feed based on listening history.

## Authentication

### Providers

No email/password. OAuth only; removing the email flow eliminates forgotten password infrastructure entirely.

| Provider | Purpose |
|---|---|
| Spotify | Login or account link |

Additional OAuth providers are still an open product decision.

### Auth Tiers

```text
Anonymous
  - Can browse albums, read reviews, see ratings
  - Spotify API via server Client Credentials token

Authenticated (any provider)
  - Can rate, review, like, follow, manage lists
  - Spotify API still via server token unless Spotify is linked

Authenticated + Spotify linked
  - Personalised feed from listening history and top artists
  - Spotify API calls use their personal access token
  - Server token preserved for anonymous traffic
```

## Routes

All album pages (`/album/:spotifyId`) are publicly accessible and shareable. These are the canonical indexable pages.

```text
/                          Public feed - trending + recent activity
/album/:spotifyId          Album page - metadata, community rating, reviews
/user/:username            Profile - ratings, reviews, lists, followers
/search                    Search albums via Spotify API and users via Ratio data
/feed                      Personalised feed (auth required)
/lists/:id                 Public list view
/settings                  Account settings, linked providers, Spotify connect
```

## Features

- Browse albums without account
- Rate albums 0.5-5 in half-star increments (auth required; stored as 1-10)
- Optional written review alongside rating, max 2000 characters
- Like reviews
- Follow users
- User profiles with rating history
- Album pages with community score and reviews
- Search albums via Spotify API and users by username/display username
- Link/unlink Spotify in settings
- Personalised feed for users with Spotify linked
- Lists: curated ranked or unranked album collections
- Activity feed: "X rated Y", "X followed Z" social activity
- Diary: chronological log of what a user has rated and when
- Popular this week: rolling aggregation for the anonymous feed
- Notifications: someone liked your review, new follower

## Feed Algorithm

### V1 Home Feed

The root route (`/`) is the single home feed for anonymous and authenticated users. It intentionally uses no feed-specific schema changes for the first production release.

The feed uses a deterministic candidate/ranking/filtering pipeline:

1. Fetch bounded candidate sets from cheap read queries.
2. Merge and deduplicate candidates by review ID.
3. Hydrate like counts with one grouped query over the bounded candidate review IDs.
4. Score candidates in application code.
5. Apply diversity filters.
6. Return review cards with cursor pagination.

Anonymous users receive a blend of:

- recent reviews in the current lookback window
- reviews with recent likes

Authenticated users receive the anonymous candidate sources plus:

- recent reviews from people they follow

The scoring weights live in `src/server/services/feed-service.ts` near the feed constants so they can be tuned without changing query logic. Current signals are:

- recency
- followed author
- written review body vs rating-only activity
- total likes
- recent likes
- candidate source

Rating-only activity is allowed but capped so it can appear for social/meme behavior without overwhelming written reviews. Repeated albums and repeated authors are also capped per page.

Feed pagination is deterministic and carries recently returned review IDs in the cursor so later pages do not return duplicate reviews. Cursor size is capped to keep URLs and `not in` filters bounded.

### Deferred Feed Work

Do not block the first production release on these:

- Add anonymous/public feed caching through a separate cached Hyperdrive binding or app-level cache; the main Hyperdrive binding keeps query caching disabled for freshness.
- Add global indexes if feed latency grows, especially `review(created_at, id)` and `review_like(created_at, review_id)`.
- Add denormalized counters only when measured load justifies the write/storage cost, e.g. `review.likeCount`, `review.lastActivityAt`, or rolling aggregates.
- Add album-level trend signals such as recent album review counts.
- Add Spotify-personalized candidate sources once Spotify-linked personalization is in scope.
- Add seen/impression tracking if the product needs stronger long-term duplicate suppression.
- Add explanations such as "because you follow..." only if the feed needs more transparency.

## Rating Display

Use a Bayesian average to prevent low-sample-count albums showing extreme scores:

```text
bayesian_score = (global_mean * min_votes + sum_of_ratings) / (min_votes + vote_count)
```

Set `min_votes` to something like 5. Tune `global_mean` from actual data over time. Show raw average alongside vote count once the album has enough ratings.

## Product Design Rules

- Keep the app quiet, dense, and content-led. Ratio should feel closer to a focused music library than a marketing page.
- Use the existing typography system and shared UI primitives first. Avoid local font changes or broad shadcn component changes unless the design system itself is being intentionally updated.
- Use CSS theme variables or semantic Tailwind tokens for all colors. Do not use raw color values in Tailwind classes; add a named token to `src/styles.css` first when the palette needs a new color.
- Hover should imply action. Add hover states to links, buttons, icon buttons, tabs, and fully clickable cards; keep static rows, metadata, and read-only content visually still.
- If only part of a card is interactive, make only that control react. Do not add full-card hover unless clicking the card itself has a clear destination.
- Motion should explain state or provide feedback. Frequent interactions should be instant or very subtle; avoid decorative animation on surfaces users scan repeatedly.
- Prefer fine-pointer-only hover treatments where relevant so touch layouts do not inherit desktop affordances.
- Use subdued metadata hierarchy. Secondary facts should be available but visually quiet, and repeated labels should be removed when nearby context already explains the content.
- Empty states should preserve the layout and communicate the absence clearly without turning into a separate promotional panel.
- Keep visual references to Spotify as mood and interaction inspiration, not direct imitation.
- When a surface uses Spotify-fetched content, include the required Spotify logo attribution in the quietest viable placement and avoid unnecessary repeated logos.

## Edge Cases

| Case | Handling |
|---|---|
| Album removed from Spotify | Keep cached metadata in existing local rows; hide or disable Spotify links when live lookup fails |
| Spotify refresh token revoked | Catch error from `getAccessToken`, fall back to client credentials, surface soft reconnect prompt in settings |
| Duplicate review attempt | Enforced at DB level via unique constraint on `(userId, albumId)`; block duplicate creates; delete may come later, no edit/update flow planned |
| Low vote count rating display | Bayesian average until threshold is met, show raw score + count after |
| Empty social feed (new user) | Fall back to trending feed until they follow someone; suggest popular users to follow on signup |
| `recently-played` too thin | Fall back to `top-artists` for feed seeding; no error state shown to user |
| Compilation / single vs album | Filter search and product surfaces to albums only; reject non-`album` Spotify IDs before creating local album rows |
| User signs in on new device | Spotify tokens stored on user record, not session; available immediately after login on any device |
| Self-follow attempt | Guard in the follow/unfollow endpoint |
