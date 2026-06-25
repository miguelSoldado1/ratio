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

### Cold Start

When no Spotify account is linked, no personalisation signal is available. Show:

1. Recent ratings from people the user follows, if authenticated
2. Trending albums this week, using most ratings/likes in a rolling 7-day window
3. Highly rated recent releases

### Warm Feed

When Spotify is linked, pull from Spotify:

- `me/top/artists`: long and medium term
- `me/player/recently-played`: last 50 tracks, deduplicated to unique albums
- `me/albums`: saved library

Surface albums from those artists that have community activity on Ratio. Blend with social feed from people the user follows.

Decay and variety rules:

- Cap per-artist representation in a single feed load, e.g. max 2 albums per artist
- Apply recency decay on `recently-played` so binge-listening one artist does not flood the feed
- If `recently-played` is thin, fall back to `top-artists` only

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
