# Database

## Schema Ownership

The current repo defines the Better Auth tables directly in `src/lib/auth/auth-schema.ts`, and `src/lib/db/schema.ts` re-exports that file as the Drizzle schema entrypoint.

Add app-level tables to the exported schema entrypoint so `drizzle-kit` can generate one coherent migration set.

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
3. Translate those changes into `src/lib/auth/auth-schema.ts`.
4. Run `pnpm db:generate`.
5. Inspect the Drizzle SQL.
6. Run `pnpm db:migrate`.

Avoid Better Auth's migrate command for this project because it mutates the database outside Drizzle's migration history.

## Worker Compatibility

Cloudflare Worker compatibility is the riskiest database integration. The current local DB client uses `postgres`, which may need to be replaced or wrapped with a Worker-compatible Postgres connection path such as Cloudflare Hyperdrive or another supported driver.

Validate this with a deployed Worker test query before building app features on top.

Deployment note from the initial Cloudflare rollout: a module-scoped `postgres` client failed in Workers during OAuth callback handling with `Cannot perform I/O on behalf of a different request`, surfaced by Better Auth as a failed `verification` query while parsing OAuth state.

The current mitigation is to create and close the `postgres` client per auth request and to use `prepare: false` for the Supabase transaction pooler on port `6543`. If DB usage expands beyond auth, revisit this before adding shared module-level DB clients.

Cloudflare Hyperdrive is a likely production-grade fix because it provides a Worker-native Postgres binding/connection proxy. Another option is moving to an edge-compatible HTTP driver where possible.

## Ratings Backend

The ratings backend uses reviews as the rating entity: one row per user per album, with an optional written body.

Store the rating as `smallint` from `1` to `10`, where UI stars remain `0.5` to `5` and half-stars map cleanly by multiplying by two.

Review creation must ensure the referenced album exists through server-trusted metadata before inserting the review. Block duplicate `(userId, albumId)` submissions, allow deleting a review, and do not expose edit/update unless the product decision changes.

Deleting the last review for an album does not delete the album row. Cleanup, if ever needed, should be a separate scheduled/admin process for old unreferenced albums.

When adding the `review.albumId -> album.id` foreign key to a database with existing reviews, choose the migration path explicitly. Disposable or empty databases can apply the final schema directly. Databases with reviews that matter should do it in phases: create `album`, backfill distinct existing review album IDs from Spotify, then add the foreign key.

## Initial App Tables

```ts
// albums: compact Spotify metadata for albums with durable Ratio activity
export const albums = pgTable("album", {
  id: text("id").primaryKey(), // Spotify album ID
  title: text("title").notNull(),
  artistNames: text("artist_names").array().notNull(),
  coverUrl: text("cover_url"),
  releaseYear: integer("release_year").notNull(),
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
