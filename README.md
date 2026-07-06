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

## Testing

Tests run under Vitest from the centralized `tests/` directory.

| Command | What it runs | Requires Postgres |
| --- | --- | --- |
| `pnpm run test:unit` | Unit, component, and hook tests under `tests/unit` | No |
| `pnpm run test:db` | DB-backed integration tests under `tests/integration` | Yes, via `DATABASE_TEST_URL` |
| `pnpm test` | Full suite: unit/component/hook tests plus DB integration tests | Yes, because DB tests are included |
| `pnpm run test:watch` | Unit/component/hook tests in watch mode | No |

DB-backed integration tests require a disposable Postgres database. The database name must include `test`; the harness refuses to run against names such as `ratio` or `postgres`.

Create the local test database once:

```sh
createdb ratio_test
```

Set `DATABASE_TEST_URL` in `.env` or pass it inline. For a local Postgres install using your macOS username:

```sh
DATABASE_TEST_URL="postgres://$(whoami)@localhost:5432/ratio_test" pnpm run test:db
```

For Docker Postgres, one simple local setup is:

```sh
docker run --name ratio-test-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ratio_test \
  -p 5432:5432 \
  -d postgres:16

DATABASE_TEST_URL="postgres://postgres:postgres@localhost:5432/ratio_test" pnpm run test:db
```

The integration harness applies committed Drizzle migrations before tests and truncates app tables between tests, so you do not need to run `pnpm db:migrate` against `ratio_test` manually. The guard still checks that `DATABASE_TEST_URL` is a Postgres URL and that the database name clearly includes `test`.

If you need a clean database outside the normal test cleanup:

```sh
dropdb ratio_test
createdb ratio_test
```

When you are done with the local test database:

```sh
dropdb ratio_test
```

If `createdb` or `dropdb` are missing, install the PostgreSQL client tools or use the Docker setup above. If Postgres is running locally without a password, `postgres://$(whoami)@localhost:5432/ratio_test` is usually the right URL shape.

Deferred future smoke flows, if the project adds e2e or route-level tests later:

- anonymous search and album browsing
- signed-in review creation
- liking a review
- following a user
- settings and account safety flows

## Useful Commands

```sh
pnpm run dev
pnpm run dev:cf
pnpm run build
pnpm run typecheck
pnpm run check
pnpm run test:unit
DATABASE_TEST_URL="postgres://$(whoami)@localhost:5432/ratio_test" pnpm run test:db
DATABASE_TEST_URL="postgres://$(whoami)@localhost:5432/ratio_test" pnpm test
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
