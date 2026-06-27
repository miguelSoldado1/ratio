# Ratio

Letterboxd for albums, built with TanStack Start, Cloudflare Workers, Supabase Postgres, Drizzle, Better Auth, and the Spotify Web API.

## Planning Docs

- [Product](docs/product.md): core concept, auth tiers, routes, features, product design rules, and edge cases.
- [Architecture](docs/architecture.md): stack and major infrastructure choices.
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
4. Create a Hyperdrive config from Supabase's direct Postgres connection string on port `5432`, then replace the `HYPERDRIVE` binding `id` in `wrangler.jsonc` with the generated config id. Do not use Supabase's transaction pooler on port `6543` for Hyperdrive.
5. Regenerate Worker types with `pnpm wrangler types`.
6. Keep `DATABASE_URL` in `.env` for local development, Drizzle Kit, migrations, and seed scripts. Worker runtime DB access uses the `HYPERDRIVE` binding instead.
7. Set production secrets with `pnpm wrangler secret put BETTER_AUTH_SECRET`, and repeat for each OAuth secret.
8. Set non-secret production values, such as `BETTER_AUTH_URL`, as Wrangler vars or secrets.
9. Run `pnpm run build` to validate the Worker bundle.
10. Deploy with `pnpm run deploy`.
11. Smoke-test the OAuth callback path after deploy.

### R2 avatar uploads and CORS

Profile photo uploads use browser direct-to-R2 uploads, so the R2 bucket CORS policy must allow the app origin that serves the upload UI.

When the deployed URL changes, update the bucket CORS origins. This includes the temporary development Workers URL and the eventual custom domain.

```json
{
	"rules": [
		{
			"allowed": {
				"methods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
				"origins": [
					"http://127.0.0.1:3000",
					"http://localhost:3000",
					"https://your-development-url.workers.dev",
					"https://your-domain.com"
				],
				"headers": ["*"]
			},
			"exposeHeaders": ["ETag"],
			"maxAgeSeconds": 3000
		}
	]
}
```

Apply the policy with:

```sh
pnpm wrangler r2 bucket cors set <bucket-name> --file <cors-file>.json
```

Keep `CLOUDFLARE_R2_PUBLIC_URL` in sync with the public URL used to serve stored avatars. The public URL does not have to match the app origin, but the CORS origins must match every app origin that performs uploads.
