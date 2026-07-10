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

Admin v1 supports sign-in for existing Ratio accounts, rejects OAuth user creation, verifies sessions and comma-separated admin roles through server functions, and exposes strict authorization middleware for protected server functions. Admin UI routes disable SSR and fetch access state and table data from the client through `useServerFn` and TanStack Query. Unauthenticated protected routes redirect through `/sign-in` with a validated internal return path; authenticated non-admin users go to `/access-denied`. The users route provides a paginated, sortable, filterable table backed by bounded database queries, and its shared table scaffold is intended for future admin resources. The app has no analytics, reviews, reports, or polling yet.

The admin cookie uses its own `ratio-admin` prefix, does not enable cross-subdomain cookies, and therefore remains host-only. The public and admin hosts do not share browser sessions or last-used-login history even though Better Auth uses the same database schema and relevant secret/provider configuration.

Future admin scope may include bounded dashboard metrics, reviews, and reports. Under the free-hosting constraint, prefer bounded indexed queries, no polling, and no new infrastructure by default.

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
