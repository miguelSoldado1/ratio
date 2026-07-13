# Product

> Ratio is Letterboxd for albums: a quiet, dense, content-led music library for browsing, rating, reviewing, and discovering albums.

## Core Concept

Ratio lets anyone browse and discover albums without an account. Authenticated users can rate, review, like, and follow others. Spotify is one of several login providers, not a requirement. Users who grant the recently-played permission additionally get a private homepage shelf of albums from their recent Spotify listening (see `spotify.md`); broader Spotify-linked personalization remains a post-launch direction.

## Authentication

### Providers

No email/password. OAuth only; removing the email flow eliminates forgotten password infrastructure entirely.

| Provider | Purpose |
|---|---|
| Spotify | Login or account link |
| Google | Login |
| Discord | Login |

Additional OAuth providers beyond these are not part of v1.

When there is no last-used login method, the authentication dialog recommends Spotify so new users can access the
recent-listening shelf without linking another account later. Returning users see their last-used method instead and
are not shown a recommendation.

### Auth Tiers

```text
Anonymous
  - Can browse albums, read reviews, see ratings
  - Spotify API via server Client Credentials token

Authenticated (any provider)
  - Can rate, review, like, follow, and manage profile/account settings
  - Catalog Spotify API calls (search, album details) use the server Client Credentials token
  - With the recently-played permission granted: a private recent-listening shelf
    on the homepage, powered by the user's own Spotify token (server-side only)
```

## Routes

All album pages (`/album/:spotifyId`) are publicly accessible and shareable. Review permalinks are album-scoped (`/album/:spotifyId/r/:reviewCode`) so a shared review keeps the album context while using a short public review code instead of the internal review UUID.

```text
/                          Public home - For You feed + signed-in Following feed
/album/:spotifyId          Album page - metadata, community rating, reviews
/album/:spotifyId/r/:reviewCode
                           Review permalink dialog over the album page
/user/:username            Profile - ratings, reviews, followers
/settings                  Account settings and linked sign-in methods
```

Search is a global command/dialog experience in v1, not a standalone route. Separate `/search`, `/feed`, and `/lists/:id` routes are deferred until the product needs those dedicated surfaces.

## Features

### V1

- Browse albums without account
- Rate albums 0.5-5 in half-star increments (auth required; stored as 1-10)
- Optional written review alongside rating, max 2000 characters
- Like reviews
- Liked-by dialog for reviews
- Follow users
- User profiles with rating history
- Profile Reviews and Likes use the shared independently scrollable tab behavior beneath one profile header, preserving each tab's position when switching
- Album pages with community score and reviews
- Search albums via Spotify API and users by username/display username from the global search dialog
- Link/unlink sign-in methods in settings
- Home For You feed blending recent reviews, recently liked reviews, and followed-user reviews when signed in
- Signed-in Following feed with reviews from followed users in reverse chronological order
- Album-scoped review permalinks and basic review sharing
- Basic admin moderation: remove bad reviews/ratings and ban abusive accounts
- Notifications: someone liked your review, new follower
- Private recent-listening shelf: up to 6 albums from the signed-in user's recently
  played Spotify tracks, at the top of the For You timeline. Ordered by most recent play, full
  albums only, cached for 30 minutes, no listening history persisted, no manual
  refresh. Visible only to the user; a linked Spotify account that needs the
  permission granted or renewed shows a quiet inline reconnect card on the
  homepage. The intended loop: listen on Spotify → open Ratio → find the album →
  rate/review it. It does not change feed ranking.

### Deferred

- Spotify-personalized feed sources from top artists or saved albums; feed ranking from listening history
- Lists: curated ranked or unranked album collections
- Dedicated `/search` route
- Dedicated `/feed` route
- Activity feed entries beyond review-card feed ranking, e.g. "X followed Y"
- Diary: chronological log of what a user has rated and when
- Popular this week as a rolling album-level aggregation
- Suggested users or onboarding recommendations
- User reports and moderation queue

## Feed Algorithm

### V1 Home Feed

The root route (`/`) is the home feed for anonymous and authenticated users. Signed-in users see independently scrollable `For You` and `Following` timelines; anonymous users see the For You feed without tabs. The recent-listening shelf sits at the top of the signed-in For You timeline. It intentionally uses no feed-specific schema changes for the first production release.

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

The signed-in-only Following tab is separate from this ranked blend. It returns reviews from followed users in strict reverse chronological order with cursor pagination, without ranking or diversity filters.

The scoring weights live in `apps/web/src/server/services/feed-service.ts` near the feed constants so they can be tuned without changing query logic. Current signals are:

- recency
- followed author
- written review body vs rating-only activity
- total likes
- recent likes
- candidate source

Rating-only activity is allowed but capped so it can appear for social/meme behavior without overwhelming written reviews. Repeated albums and repeated authors are also capped per page.

Feed pagination is deterministic and carries recently returned review IDs in the cursor so later pages do not return duplicate reviews. This is a v1 tradeoff that fits the bounded candidate-window design: each page can re-query the small candidate set, exclude seen IDs, rank the remainder, and stay deterministic without schema changes. Cursor size is capped to keep URLs and `not in` filters bounded.

### Deferred Feed Work

Do not block the first production release on these:

- Add anonymous/public feed caching through a separate cached Hyperdrive binding or app-level cache; the main Hyperdrive binding keeps query caching disabled for freshness.
- Replace seen-ID cursor pagination when feed scale justifies it, likely with cached anonymous candidate IDs, a materialized feed/ranking table, or another indexed candidate-store design.
- Add global indexes if feed latency grows, especially `review(created_at, id)` and `review_like(created_at, review_id)`.
- Add denormalized counters only when measured load justifies the write/storage cost, e.g. `review.likeCount`, `review.lastActivityAt`, or rolling aggregates.
- Add album-level trend signals such as recent album review counts.
- Add Spotify-personalized candidate sources once Spotify account linking and personal token usage are in scope.
- Add seen/impression tracking if the product needs stronger long-term duplicate suppression.
- Add explanations such as "because you follow..." only if the feed needs more transparency.

## Album Reviews

Authenticated album review lists should show the viewer's own review first when present. This makes the disabled `Add a review` action self-explanatory without adding persistent helper text or a tooltip to the album actions.

The v1 query uses two index-friendly reads on the first page: fetch the viewer review by `(userId, albumId)`, fetch the normal album review page by `(albumId, createdAt, id)` while excluding the viewer, then merge in application code. Cursor pages only read the normal chronological page and continue excluding the viewer to avoid duplicates. This avoids a computed pin sort on the primary album review list.

## Rating Display

Use a Bayesian average to prevent low-sample-count albums showing extreme scores:

```text
bayesian_score = (global_mean * min_votes + sum_of_ratings) / (min_votes + vote_count)
```

Set `min_votes` to something like 5. Tune `global_mean` from actual data over time. Show raw average alongside vote count once the album has enough ratings.

## Product Design Rules

- Keep the app quiet, dense, and content-led. Ratio should feel closer to a focused music library than a marketing page.
- Use the existing typography system and shared UI primitives first. Avoid local font changes or broad shadcn component changes unless the design system itself is being intentionally updated.
- Use CSS theme variables or semantic Tailwind tokens for all colors. Do not use raw color values in Tailwind classes; add a named token to `apps/web/src/styles.css` first when the palette needs a new color.
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
| Duplicate review attempt | Enforced at DB level via unique constraint on `(userId, albumId)`; block duplicate creates; delete may come later, no edit/update flow planned |
| Low vote count rating display | Bayesian average until threshold is met, show raw score + count after |
| Empty Following feed (new user) | Show a quiet empty state; the For You tab remains fully usable |
| Spotify recent-listening unavailable | Omit the shelf unless reauthorization is actionable; the feed loads independently and stays fully usable |
| Spotify permission missing or token rejected | Show the inline reconnect card for a linked account; reauthorize in place without requiring another sign-in provider |
| Spotify refresh token expired, revoked, or unavailable | Show the inline reconnect card when Better Auth cannot retrieve a valid token. A transient token-endpoint outage may cause an unnecessary reconnect prompt in v1; never revoke the Ratio session |
| Compilation / single vs album | Filter search and product surfaces to albums only; reject non-`album` Spotify IDs before creating local album rows |
| Self-follow attempt | Guard in the follow/unfollow endpoint |
