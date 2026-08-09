# Architecture

## Workspace

Ratio is a pnpm monorepo with two independently built TanStack Start applications and two narrow shared packages:

```text
apps/web              Public Ratio application (`@ratio/web`)
apps/admin            Authentication-only admin application (`@ratio/admin`)
packages/auth-providers
                      Shared OAuth provider catalog, types, and brand icons
packages/database     Shared Drizzle schema, types, and Worker-compatible client factory
drizzle               Authoritative migration history
```

The public application remains the `ratio` Cloudflare Worker at `ratiomusic.live`; its `development` Wrangler environment remains at `dev.ratiomusic.live`. The admin application is a separate `ratio-admin` Worker intended for `admin.ratiomusic.live`, with the explicit development Worker `ratio-admin-dev` intended for `admin-dev.ratiomusic.live`.

Each app owns its routes, shadcn components, authentication UI and behavior, dependencies, Vite build, generated route tree, tests, Wrangler configuration, and deployment output. `packages/auth-providers` owns one canonical provider array containing the provider IDs, labels, and approved brand-image components, but no buttons, dialogs, pages, or auth clients. `packages/database` is deliberately narrow and contains no Spotify, cache, upload, R2, rate-limit, or product-service code.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | TanStack Start | Separate Vite builds in `apps/web` and `apps/admin` |
| Deployment | Cloudflare Workers | Independent public/admin Workers and development environments |
| Database | Supabase (Postgres) | Both apps reuse the existing databases through environment-specific Hyperdrive bindings |
| ORM | Drizzle 0.45.x | Shared schema; Drizzle remains the only migration owner |
| Auth | Better Auth 1.6.23 | Shared auth tables and secret, but separate host-only application sessions |
| Music data | Spotify Web API | Public app only; see `spotify.md` |

## Admin Boundary

Admin v1 supports sign-in for existing Ratio accounts, rejects OAuth user creation, verifies sessions and comma-separated admin roles through server functions, and exposes strict authorization middleware for protected server functions. Admin UI routes disable SSR and fetch access state, aggregate metrics, and table data from the client through `useServerFn` and TanStack Query. Unauthenticated protected routes redirect through `/sign-in` with a validated internal return path; authenticated non-admin users go to `/access-denied`. The overview route provides request-driven 30-day community growth and participation metrics for users, reviews, replies, lists, and retained list items. The users and reviews routes provide paginated, sortable, filterable tables backed by bounded database queries, and their shared table scaffold is intended for future admin resources. The app has no polling or separate analytics infrastructure.

The admin cookie uses its own `ratio-admin` prefix, does not enable cross-subdomain cookies, and therefore remains
host-only. The public and admin hosts do not share browser sessions even though Better Auth uses the same database
schema and relevant secret/provider configuration.

Admin user deletion intentionally does not give the admin Worker R2 bindings or S3-compatible avatar credentials. Better Auth and the database cascades remove the account data, while a custom avatar may remain orphaned in R2. Self-service account deletion in the public app still removes its avatar. If admin-deletion orphans become material, prefer a bounded reconciliation script run with the public app's existing storage credentials instead of duplicating R2 secrets across admin environments.

Future admin scope may include bounded dashboard metrics, reviews, and reports. Under the free-hosting constraint, prefer bounded indexed queries, no polling, and no new infrastructure by default.

## Review Conversation Boundary

`routes/album/$albumId.tsx` owns the full album page, while `routes/review/$reviewId.tsx` owns the standalone
conversation page. The routes are independent, so a direct review permalink does not mount or fetch `AlbumPage`.
`ReviewConversation` owns query and mutation behavior while
`ReviewConversationContent` and the focused reply components remain independent of page/dialog shells.

Album and feed cards receive scalar reply counts from one batched query over the final visible review IDs.
Neither For You nor Following reads reply-activity candidates, and no review-list DTO serializes reply bodies,
reply-author identity, or reply-like state. Following uses the normal `(createdAt, reviewId)` review cursor.

Review, reply, and list creation share the native Cloudflare content-creation rate-limit binding. Reply reads, likes,
and notifications stay request-driven; there is no polling, queue, KV thread cache, denormalized counter, or
materialized activity table.

## Public Route Metadata Boundary

Album, review, and profile routes keep their visible page content client-rendered. Their TanStack Start routes use
`ssr: "data-only"` loaders solely to resolve server-generated head metadata for the initial response and later route
navigations. Metadata loaders disable intent preloading so hovering links can still preload route code without issuing
metadata RPCs. The loader result must stay narrow and must not seed or replace the page's TanStack Query data.

`/album/:albumId` resolves title, artists, and cover art from an existing local album row first. Albums without a local
row use the same server-owned album-details KV key and Spotify fetch as the client album query, removing the separate
persistence-cache write path and allowing the following client request to reuse the same cached result.
`/review/:reviewId` performs one public database lookup for the persisted album title, artists, cover,
reviewer identity, and rating; it does not fetch Spotify or include the review body. `/user/:username` performs a minimal
public database lookup for display name, username, and avatar only; it does not read session, relationship, review-count,
or other profile-page state.

Metadata failures return generic head content and never prevent the client page from rendering. That fallback omits the
`robots` tag rather than emitting `noindex`: a transient lookup failure is indistinguishable from a genuinely missing
record, and deindexing a live page during a database or Spotify outage costs another crawl to undo. Absent records are
left to the client-rendered not-found page and search-engine soft-404 handling.

## Cloudflare Git Builds

Connect the same GitHub repository independently to each Worker. Use `apps/web` and `apps/admin` as their respective root directories so each Wrangler file and build output stays app-local. Configure watch paths to include the app directory plus `packages/database`, the root lockfile/workspace manifests, and relevant shared configuration or migrations. Changes that affect only one app should not build the other unless a shared path changed.

Suggested build wiring:

| Worker | Root | Build command | Environment selection |
|---|---|---|---|
| `ratio` | `apps/web` | `pnpm build` | top-level production config |
| existing public development Worker | `apps/web` | `pnpm build:development` | `CLOUDFLARE_ENV=development`; deploy with `--env development` |
| `ratio-admin` | `apps/admin` | `pnpm build` | top-level production config |
| `ratio-admin-dev` | `apps/admin` | `pnpm build:development` | `CLOUDFLARE_ENV=development`; deploy with `--env development` |

At minimum, web watch paths should include `apps/web/*`, `packages/database/*`, `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`; admin watch paths should replace `apps/web/*` with `apps/admin/*`. Include root database configuration and `drizzle/*` when schema/migration changes should trigger deployment verification.

## Coding Conventions

Implementation conventions for route organization, TanStack Query, server functions, and mutation handling live in `AGENTS.md` so coding agents and contributors follow the same rules.

`SwipeableTabs` owns horizontal swipe navigation and an independent vertical scroller for every panel by default. Consumers only need to place it inside a bounded flex-height layout. Infinite-list sentinels automatically use their nearest swipeable panel as the intersection root; explicit roots remain available for other nested scrollers such as notification menus.
