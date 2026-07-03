# Roadmap

## Current Priority

Ratio is moving from the core review loop toward a first production release. The next work should prioritize public identity, basic moderation, social behavior, retention, and sharing before deeper personalization.

## Production Build Order

Use this as a directional order, not a locked feature spec.

```text
1. Username identity pass
2. Admin v1
3. Top bar polish
4. User search
5. Followers
6. Notifications v1
7. Real home feed (v1 built: deterministic review feed, no schema changes)
8. Album-scoped review permalink route
9. Basic review sharing
10. Liked-by dialog
11. Launch hardening
```

## Notes

- Keep username URLs first-class, but use stable IDs internally.
- Admin v1 should stay small: enough to remove bad reviews/ratings, not a full dashboard.
- Build reusable user-list UI where possible for followers, following, and liked-by views.
- Notifications should come before advanced feed work because they make the social loop feel alive.
- Home feed v1 is intentionally conservative: no feed-specific schema changes, bounded candidate queries, deterministic ranking, seen-ID cursor pagination, and no Spotify personalization. The cursor design is acceptable for v1 because the candidate windows are small; replace it with cached candidate IDs or a materialized feed/ranking store if feed scale grows.
- `/album/:spotifyId/r/:reviewCode` is the canonical target for shared reviews so the focused review keeps album context without exposing the internal review UUID.

## Post-Launch Work

Do not block the first production release on these unless the product direction changes.

```text
- Advanced feed algorithm
- Anonymous feed caching through a separate cached Hyperdrive binding or app-level cache
- Feed indexes and denormalized counters once usage data justifies them
- Spotify-personalized feed
- Realtime notifications
- Instagram image card generation
- Notification grouping and settings
- User reports and moderation queue
- Admin analytics dashboard
- Full user suspension/deletion UI
- Lists
- Advanced user search ranking
- Full profanity/slur filtering
- Separate admin app or Worker
```

## Open Decisions

- **Additional OAuth providers**: Spotify, Google, and Discord are the v1 providers; decide later whether more providers belong in the product.
- **Review editing**: deleting a review exists or is planned, but editing/updating remains out of scope for now.
- **Spotify reconnect UX**: soft prompt in feed/settings, or hard gate on personalised features?
- **Username policy**: final limits, cooldowns, and redirect behavior can be decided when the identity pass starts.
- **Admin host routing**: admin routes can live in this app first; later decide how `admin.ratio.music` maps to them.
