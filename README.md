# Ratio

Letterboxd for albums, built with TanStack Start, Cloudflare Workers, Supabase Postgres, Drizzle, Better Auth, and the Spotify Web API.

## Planning Docs

- [Product](docs/product.md): core concept, auth tiers, routes, features, product design rules, and edge cases.
- [Architecture](docs/architecture.md): stack, route organization, TanStack data-fetching conventions, and client mutation handling.
- [Database](docs/database.md): Drizzle schema ownership, migration workflow, Better Auth schema changes, Worker compatibility, and table design.
- [Spotify](docs/spotify.md): attribution, login/linking behavior, token strategy, album caching, and search.
- [Roadmap](docs/roadmap.md): build order, feed algorithm, rating display, and open decisions.

## Development

Use `.env` for local values such as `DATABASE_URL`, `BETTER_AUTH_URL`, and OAuth client credentials.

```sh
pnpm install
pnpm run dev
```

Use `pnpm run dev:cf` when you want to exercise the Cloudflare runtime locally.

## Useful Commands

```sh
pnpm run dev
pnpm run dev:cf
pnpm run build
pnpm run typecheck
pnpm run check
pnpm test
```

## Cloudflare deployment

This app is configured for Cloudflare Workers through the Cloudflare Vite plugin and Wrangler.

1. Log in with `pnpm wrangler login`.
2. Confirm the `CACHE` KV namespace binding in `wrangler.jsonc`. If you need to recreate it, run `pnpm wrangler kv namespace create CACHE` and replace the binding `id` with the generated value.
3. Optionally create a preview namespace with `pnpm wrangler kv namespace create CACHE --preview` and add its `preview_id` to the same binding.
4. Set production secrets with `pnpm wrangler secret put DATABASE_URL`, `pnpm wrangler secret put BETTER_AUTH_SECRET`, and repeat for each OAuth secret.
5. Set non-secret production values, such as `BETTER_AUTH_URL`, as Wrangler vars or secrets.
6. Run `pnpm run build` to validate the Worker bundle.
7. Deploy with `pnpm run deploy`.
