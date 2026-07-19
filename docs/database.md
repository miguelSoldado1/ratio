# Database

## Schema Ownership

The shared schema entrypoint is `packages/database/src/schema.ts`. Better Auth tables live in `packages/database/src/auth-schema.ts` and are re-exported from the same schema entrypoint.

Both applications consume `@ratio/database`, but Drizzle remains the sole migration owner. Add app-level tables to the shared schema entrypoint so `drizzle-kit` generates one coherent migration set. The existing root `drizzle/` history remains authoritative, and root `drizzle.config.ts` points at the shared schema.

## Drizzle Migration Workflow

Use generated Drizzle migrations as the source of truth for schema changes.

Default workflow:

```sh
pnpm db:generate
pnpm db:migrate
```

For each schema change:

1. Update the schema files.
2. Run `pnpm db:generate`.
3. Inspect the generated SQL in `drizzle/`.
4. Run `pnpm db:migrate` only after the SQL looks correct.
5. Commit the schema changes and generated `drizzle/` migration files together.

Do not use `pnpm db:push` against databases with real data. Reserve `db:push` only for disposable local or throwaway databases.

The current database has been baselined against the generated `0000` migration. Keep the `drizzle/` folder committed so future `db:generate` runs have a stable migration history.

## Better Auth Schema Changes

Drizzle owns database migrations in this repo. Do not let Better Auth and Drizzle both apply migrations to the same database.

When a Better Auth plugin requires schema changes, such as an admin plugin:

1. Add or configure the Better Auth plugin.
2. Run Better Auth's generate command as a reference for the schema it expects.
3. Translate those changes into `packages/database/src/auth-schema.ts`.
4. Run `pnpm db:generate`.
5. Inspect the Drizzle SQL.
6. Run `pnpm db:migrate`.

Avoid Better Auth's migrate command for this project because it mutates the database outside Drizzle's migration history.

## Worker Compatibility

Cloudflare Worker database access goes through each app's `HYPERDRIVE` binding in `apps/web/wrangler.jsonc` and `apps/admin/wrangler.jsonc`. Local development, Drizzle Kit migrations, and seed scripts continue to use `DATABASE_URL` directly.

Create Hyperdrive configs from Supabase's direct Postgres connection string on port `5432`, not the Supabase transaction pooler on port `6543`. Both Workers reuse the existing production and development Hyperdrive configurations; do not create separate Supabase projects for admin.

### Database Credential Rotation

The deployed Workers use the environment-specific `HYPERDRIVE` binding as their runtime database connection. Updating
the `DATABASE_URL` Worker secret alone does not update that connection; `DATABASE_URL` is used directly by local
development, Drizzle Kit, and the seed scripts.

Whenever a Supabase database password, hostname, user, port, or database name changes:

1. Update the local `DATABASE_URL` used by Drizzle Kit and scripts.
2. Update every affected existing Hyperdrive configuration referenced in either app's `wrangler.jsonc`, including production and
   development when they share the rotated credential. Prefer updating the existing configuration so its binding id
   stays unchanged and no Worker deployment is required.
3. Run `pnpm wrangler hyperdrive get <hyperdrive-id>` and confirm `modified_on` reflects the update.
4. Smoke-test the public feed, an album's ratings and reviews, and an OAuth callback.

Cloudflare validates new connection details during an update, but updating a configuration does not tear down its
existing connection pool. New connections use the new credentials, so update Hyperdrive immediately after rotating a
database password. See Cloudflare's
[credential-rotation guide](https://developers.cloudflare.com/hyperdrive/configuration/rotate-credentials/).

Do not introduce a module-scoped Worker DB singleton. `packages/database/src/index.ts` exposes a database accessor factory: local development can reuse a singleton client inside the accessor, while every Cloudflare Worker request creates a request-scoped `postgres`/Drizzle client from that app's `HYPERDRIVE` binding. Hyperdrive owns the underlying origin pool and Worker invocation cleanup, so server functions should not carry explicit `client.end()` boilerplate.

The admin app performs no product/admin queries in this milestone. Better Auth still performs the session, user, account, and OAuth reads/writes necessary to authenticate and authorize requests.

Hyperdrive query caching is currently disabled on the main `HYPERDRIVE` config so fresh review and like reads stay visible as quickly as possible. Hyperdrive caching is configured per Hyperdrive config, not toggled inside individual Drizzle queries. If future public read endpoints need Hyperdrive query caching, add a separate cached Hyperdrive config/binding and route only those public reads through that binding, or use an app-level cache such as KV/Cache API. Avoid cached Hyperdrive reads for auth/session reads, viewer-specific booleans such as `likedByViewer` and `followedByViewer`, and mutation-adjacent checks where users expect immediate freshness.

Deployment note from the initial Cloudflare rollout: a module-scoped `postgres` client failed in Workers during OAuth callback handling with `Cannot perform I/O on behalf of a different request`, surfaced by Better Auth as a failed `verification` query while parsing OAuth state.

After deploy, smoke-test the OAuth callback path because that was where the previous Worker request-lifetime issue surfaced.

## Ratings Backend

The ratings backend uses reviews as the rating entity: one row per user per album, with an optional written body.

Store the rating as `smallint` from `1` to `10`, where UI stars remain `0.5` to `5` and half-stars map cleanly by multiplying by two.

Review creation must ensure the referenced album exists through server-trusted metadata before inserting the review. Block duplicate `(userId, albumId)` submissions, allow deleting a review, and do not expose edit/update unless the product decision changes.

Deleting the last review for an album does not delete the album row. Cleanup, if ever needed, should be a separate scheduled/admin process for old unreferenced albums.

When adding the `review.albumId -> album.id` foreign key to a database with existing reviews, choose the migration path explicitly. Disposable or empty databases can apply the final schema directly. Databases with reviews that matter should do it in phases: create `album`, backfill distinct existing review album IDs from Spotify, then add the foreign key.

## Review Replies

`review_reply` stores one-level, immutable reply text against a root review. It uses a random UUID primary key, cascading
review/user foreign keys, a database-enforced trimmed-content equivalent of 1–500 characters, and no update timestamp.
The indexes `(review_id, created_at, id)` and `(user_id, created_at, id)` support oldest-first thread pagination,
batched counts, and account deletion.

`review_reply_like` uses `(reply_id, user_id)` as its primary key for idempotent likes. Its additional
`(user_id, created_at, reply_id)` index supports account cleanup and user activity without adding a redundant
reply-only index. Review deletion cascades through replies, reply likes, and reply-targeted notifications.

Reply counts are computed from visible rows in bounded queries. Reply content is fetched only for the standalone
conversation page. There are deliberately no denormalized
reply counters, thread activity columns, materialized feed rows, or realtime infrastructure.

## Reply Notifications

`notification_type` contains `review_liked`, `review_replied`, `reply_liked`, and `user_followed`.
`notification.reply_id` is nullable and cascades to `review_reply`; a check constraint enforces the target-column
matrix for every type. Partial unique indexes keep one updatable review-reply notification per recipient/thread and
one reply-like notification per recipient/actor/reply. Partial `review_id` and `reply_id` indexes support foreign-key
cascades.

Migration `0002_exotic_red_hulk.sql` replaces the PostgreSQL enum inside the migration transaction instead of using
`ALTER TYPE ... ADD VALUE`, because Drizzle 0.45 wraps pending migrations together and PostgreSQL cannot use a newly
added enum value before commit. The integration suite verifies both a fresh isolated schema and an upgrade containing
existing review-like and follow notifications.

Deploy the migration before application code that queries reply tables. Development and production migration state
must be checked independently; never assume a successful local migration updated a Worker's remote database.

## Initial App Tables

```ts
// albums: compact Spotify metadata for albums with durable Ratio activity
export const albums = pgTable("album", {
  id: text("id").primaryKey(), // Spotify album ID
  title: text("title").notNull(),
  artistNames: text("artist_names").array().notNull(),
  coverUrl: text("cover_url"),
  releaseDate: date("release_date").notNull(),
  totalTracks: integer("total_tracks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

// reviews: one per user per album, rating + optional written body
export const reviews = pgTable("review", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  albumId: text("album_id").notNull().references(() => albums.id),
  rating: smallint("rating").notNull(), // 1-10, UI rating 0.5-5 multiplied by two
  body: text("body"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.albumId),
  ratingRange: check("reviews_ratings_range_check", sql`${t.rating} >= 1 AND ${t.rating} <= 10`),
}))

// likes: on reviews, not albums
export const likes = pgTable("likes", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.reviewId] }),
}))

// follows: user graph
export const follows = pgTable("follows", {
  followerId: text("follower_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followerId, t.followingId] }),
}))

// lists: user-curated album collections
export const lists = pgTable("lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  ranked: boolean("ranked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export const listItems = pgTable("list_items", {
  listId: uuid("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  albumId: text("album_id").notNull().references(() => albums.id),
  position: integer("position"),
  note: text("note"),
}, (t) => ({
  pk: primaryKey({ columns: [t.listId, t.albumId] }),
}))
```
