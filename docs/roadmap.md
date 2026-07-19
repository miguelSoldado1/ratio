# Roadmap

## Current Priority

The flat review-conversation milestone is implemented through release hardening. Core replies, reply likes,
notifications, card reply counts, and the standalone review permalink are in place.
The remaining launch work is operational: apply the committed migration in each deployment environment before the
corresponding code deploy, smoke-test the deployed flows, and watch existing provider usage dashboards.

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
8. Review permalink route
9. Basic review sharing
10. Liked-by dialog
11. Launch hardening
```

## Notes

- Keep username URLs first-class, but use stable IDs internally.
- The separate admin app now includes a reusable server-driven table scaffold and its first resource table for users.
- Future admin scope is bounded dashboard metrics, users, reviews, and reports. Prefer bounded indexed queries, no polling, and no new infrastructure by default so it remains viable on free hosting.
- Build reusable user-list UI where possible for followers, following, and liked-by views.
- Notifications should come before advanced feed work because they make the social loop feel alive.
- Home feed v1 is intentionally conservative: no feed-specific schema changes, bounded candidate queries, deterministic ranking, seen-ID cursor pagination, and no Spotify personalization. The cursor design is acceptable for v1 because the candidate windows are small; replace it with cached candidate IDs or a materialized feed/ranking store if feed scale grows.
- Review-list surfaces expose only reply counts. Reply content and reply interactions stay on the standalone review
  permalink; replies do not influence For You or Following candidates.
- `/review/:reviewId` is the standalone conversation target for shared reviews without loading the full album page.

## Post-Launch Work

Do not block the first production release on these unless the product direction changes.

```text
- Advanced feed algorithm
- Anonymous feed caching through a separate cached Hyperdrive binding or app-level cache
- Feed indexes and denormalized counters once usage data justifies them
- Spotify-personalized feed
- Further personal-Spotify-token features beyond the shipped recent-listening shelf
  (top tracks/artists via user-top-read, Liked Songs via user-library-read)
- Recent-listening shelf follow-ups if usage justifies them: manual refresh,
  "hide this section" preference
- Realtime notifications
- Instagram image card generation
- Notification preferences, thread muting, and per-type settings
- User reports and moderation queue in the separate admin app
- Bounded admin analytics dashboard
- Full user suspension/deletion UI
- Lists
- Advanced user search ranking
- Full profanity/slur filtering
```

## Open Decisions

- **Additional OAuth providers**: Spotify, Google, and Discord are the v1 providers; decide later whether more providers belong in the product.
- **Review editing**: deleting a review exists or is planned, but editing/updating remains out of scope for now.
- **Username policy**: final limits, cooldowns, and redirect behavior can be decided when the identity pass starts.

## Admin Deployment Follow-ups

- Create or connect `ratio-admin` and `ratio-admin-dev` in Cloudflare.
- Connect the same GitHub repository independently to the public and admin Workers. Configure per-app root directories, production/development branches, build and deploy commands, and watch paths that include `packages/database` plus root workspace/lockfile changes.
- Configure the shared Better Auth secret and OAuth client secrets separately in both admin Worker environments.
- Add the exact admin callback URLs in each provider dashboard:
  - Spotify: `https://admin.ratiomusic.live/api/auth/callback/spotify` and `https://admin-dev.ratiomusic.live/api/auth/callback/spotify`
  - Google: `https://admin.ratiomusic.live/api/auth/callback/google` and `https://admin-dev.ratiomusic.live/api/auth/callback/google`
  - Discord: `https://admin.ratiomusic.live/api/auth/callback/discord` and `https://admin-dev.ratiomusic.live/api/auth/callback/discord`
- Configure DNS/custom domains for `admin.ratiomusic.live` and `admin-dev.ratiomusic.live`.
- Smoke-test all admin OAuth callbacks after deployment. Do not assume `admin-dev.ratiomusic.live` DNS or provider callbacks already exist.
