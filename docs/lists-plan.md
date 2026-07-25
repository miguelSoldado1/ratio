# Lists v1 — Implementation Plan

Working plan for album lists. Delete this file once the feature ships and the durable parts have been
folded into `docs/product.md` and `docs/database.md`.

## Goal

Ratio currently has one content type, and it is coupled to listening cadence — a review requires having
just heard something. Lists decouple content creation from listening: one person can author twenty
opinionated lists in an evening from things they already believe. That fixes two problems at once. It
makes the app stop looking like fifteen albums, and it produces public, linkable pages worth posting to
Reddit and Discord.

Every design choice below is subordinate to that: **lists must be public, must be fast to author in bulk,
and must be worth clicking through to.**

## Scope Boundaries

Deliberately in v1:

- Public lists with a title, optional description, and an ordered set of albums
- Ordering is "the order you added them", rendered with a display index (1, 2, 3…)
- Inline authoring: the list page *is* the editor when you own it — add and remove albums, rename, delete.
  No separate edit route
- A Lists tab on profiles, and a public `/list/:listId` route

Deliberately deferred:

- Drag-and-drop reordering — most of the cost, and it retrofits with one additive migration
- A `ranked` toggle — every list is numbered, which gets the "top 10" look for free without a form control
- Private lists and a visibility toggle
- Per-item notes
- Lists in the For You / Following feeds
- List likes, comments, or follower counts

## Schema

Add to `packages/database/src/schema.ts`. This supersedes the older sketch at the bottom of
`docs/database.md`, which predates the current conventions.

```ts
export const lists = pgTable(
  "list",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("lists_user_created_id_idx").on(table.userId, table.createdAt, table.id),
    check(
      "lists_title_length_check",
      sql`char_length(${table.title}) between 1 and 100 and ${table.title} ~ '[^[:space:]]'`
    ),
    check(
      "lists_description_length_check",
      sql`${table.description} is null
        or (char_length(${table.description}) between 1 and 500 and ${table.description} ~ '[^[:space:]]')`
    ),
  ]
);

export const listItems = pgTable(
  "list_item",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.albumId], name: "list_items_list_album_pk" }),
    index("list_items_list_created_album_idx").on(table.listId, table.createdAt, table.albumId),
    index("list_items_album_id_idx").on(table.albumId),
  ]
);
```

Notes on the choices:

- The `(list_id, album_id)` composite PK makes "album already in this list" a single indexed lookup and
  makes adds idempotent via `onConflictDoNothing`.
- `album_id` references `albums.id` with no cascade, matching `reviews.albumId`. Albums outlive the rows
  that reference them.
- **There is no `position` column.** Order is insertion order, and `(list_id, created_at, album_id)`
  serves it directly. A `position` column would be redundant until reordering exists, and it would add a
  `SELECT max(position)` before every insert — ten extra round trips in a ten-album bulk-add — to support
  a feature that may never ship. Ordering includes `album_id` as a tiebreaker so two inserts landing in
  the same millisecond stay deterministic, matching the `(created_at, id)` convention used by the review
  and reply indexes.
- If reordering does land later, add `position` in one additive migration and backfill with
  `row_number() over (partition by list_id order by created_at, album_id)`. Deterministic, no data loss.

Relations:

```ts
export const listRelations = relations(lists, ({ many, one }) => ({
  items: many(listItems),
  user: one(user, { fields: [lists.userId], references: [user.id] }),
}));

export const listItemRelations = relations(listItems, ({ one }) => ({
  album: one(albums, { fields: [listItems.albumId], references: [albums.id] }),
  list: one(lists, { fields: [listItems.listId], references: [lists.id] }),
}));
```

Also extend `albumRelations` with `listItems: many(listItems)`.

### Migration

`pnpm db:generate`, inspect the generated SQL, `pnpm db:migrate`. Purely additive — two tables, no enum
changes, so none of the `notification_type` transaction hazards apply.

The next sequential migration is `0004`, but `docs/reports-plan.md` also targets `0004`. Whichever
feature ships second takes `0005`; do not hardcode the number when writing this up.

## Phase 1 — Server

### `apps/web/src/server/services/list-service.ts`

Constants:

```ts
const maxListItems = 100;
const listsPageSize = 20;
```

There is deliberately **no cap on lists per user**. `listCreateHourlyRateLimit` already bounds creation
rate, and an empty list row is negligible storage, so a stock limit protects nothing.

`maxListItems` exists for a different reason: `getListService` returns every item in one unpaginated
query and the page renders all of them, so the cap bounds that read. Raise it only alongside pagination.

**`getListService({ listId })`** — public read, no auth required.

Join `lists → user` and apply the same author-visibility rule used everywhere else in the app:
`username is not null` and `banned is not true`. A list by a banned author must 404, not render — **with
an admin bypass**, matching `getThreadVisibilityFilter`'s `isAdmin ? undefined : ...` shape, so moderators
can still open hidden content. Then fetch items joined to `albums`, ordered by `createdAt asc, albumId asc`.
Return the list, its author, the ordered albums, and `canEdit` computed from the optional viewer via
`getOptionalCurrentUser`.

**`getUserListsService({ userId, cursor })`** — the profile tab. Keyset pagination on
`(created_at, id)` descending using the existing `encodeCursor` / `decodeCursor` / `getCreatedAtIdCursorFilter`
helpers in `server-utils.ts`.

Each row also needs an item count and the first three cover URLs for the stacked-artwork card. Get both
from a `LATERAL` subquery per list rather than a second round trip or a per-row fetch — this is the one
place in the feature where a naive implementation becomes N+1:

```sql
left join lateral (
  select count(*)::int as item_count,
         (array_agg(a.cover_url order by li.created_at, li.album_id))[1:3] as cover_urls
  from list_item li
  join album a on a.id = li.album_id
  where li.list_id = list.id
) items on true
```

**`createListService({ title, description }, context)`** — insert and return the new id so the client can
navigate straight to it.

**`updateListService` / `deleteListService`** — ownership check `list.userId === context.user.id`. Give
delete an admin bypass via `context.user.isAdmin`, matching `deleteReviewReplyService`, so moderation
stays consistent.

**`addListItemService({ listId, albumId }, context)`** — the one with real substance:

```ts
export async function addListItemService(data: AddListItemInput, context: AuthenticatedContext) {
  // Network call OUTSIDE the transaction, exactly as createReviewService does.
  const albumMetadata = await getMissingAlbumMetadataForWrite(data.albumId, context.db);

  return await context.db.transaction(async (transaction) => {
    // ownership check, item-count cap, then:
    await ensureAlbumExistsForWrite(albumMetadata, transaction);

    await transaction
      .insert(listItems)
      .values({ albumId: data.albumId, listId: data.listId })
      .onConflictDoNothing();
  });
}
```

With no `position` to compute, the add is a single insert — no read-before-write, no row lock, nothing to
serialize. Two things this still makes explicit, and both matter:

1. The Spotify metadata fetch must happen before `transaction()`, never inside it. `createReviewService`
   at `review-service.ts:539` is the reference — holding a transaction open across a network call is how
   you exhaust the Hyperdrive pool.
2. Lists become the **second** writer of `album` rows. Combined with reviews, albums with zero reviews
   are now a normal state rather than an edge case. `docs/database.md` already says deleting the last
   review does not delete the album; that note now covers more ground and should say so.

**`removeListItemService`** — ownership check, delete by `(listId, albumId)`. Nothing to renumber.

### `apps/web/src/server/functions/list-functions.ts`

Reads (`getList`, `getUserLists`) take no middleware, matching `getReviewReplies`. Mutations take
`authMiddleware` + `createCloudflareRateLimitMiddleware(userMutationRateLimit)`, plus a fixed-window cap
on creation specifically.

That rule belongs in `apps/web/src/server/rate-limit.ts`, not here — `defineFixedWindowRateLimitRule` is
module-private to that file. Add it next to `reviewCreateHourlyRateLimit`:

```ts
export const listCreateHourlyRateLimit = defineFixedWindowRateLimitRule({
  limit: 15,
  scope: "list-create-hourly",
  windowSeconds: 60 * 60,
});
```

No new Cloudflare binding needed — the fixed-window limiter runs on the existing `CACHE` KV namespace, and
item adds ride the existing `USER_MUTATION_RATE_LIMITER`.

## Phase 2 — Routes and SEO

`apps/web/src/routes/list/$listId.tsx`, folder-style per `AGENTS.md`. Singular `list/` matches the
existing `album/`, `review/`, `user/` convention; `product.md` currently parks `/lists/:id` as deferred, so
update that line.

Set `notFoundComponent: NotFoundPage`, matching `review/$reviewId.tsx`. This route will actually hit it —
`getListService` 404s both missing lists and lists by banned authors.

The route is **client-side only**, matching every other route in the app. Data comes from `useQuery` and
the `head` block builds meta from route params alone. No loader — page transitions stay immediate.

```ts
head: ({ params }) => {
  const path = `/list/${params.listId}`;

  return {
    links: [createCanonicalLink(path)],
    meta: createSeoMeta({
      description: "An album list on Ratio.",
      path,
      title: `Album List | ${siteName}`,
      type: "article",
    }),
  };
},
```

### Known tradeoff: link previews are generic

Recorded as a decision so it isn't later rediscovered as a bug. Crawlers do not execute JavaScript, so
meta built from client-fetched data never reaches the HTML they read. Every list URL unfurls on Reddit,
Discord, Twitter, and iMessage as `Album List | Ratio` with the default `/og-image.png` — no list title,
no cover art.

`album/$albumId.tsx` and `review/$reviewId.tsx` already behave this way, so `ReviewShareButton` currently
produces an identical generic preview for every review anyone shares. Lists inherit the existing
behaviour rather than introducing it.

The fix, whenever it's judged worth it, is narrow: a loader returning only title, description, and first
cover URL — roughly 200 bytes from one indexed query — while list content keeps loading client-side.
Router loaders block only the initial document request; in-app navigation runs them as client fetches, so
transition feel is unaffected. Explicitly not now.

## Phase 3 — Components

New files under `apps/web/src/components/list/`:

- **`list-page.tsx`** — header (title, description, author via the existing profile-link treatment, item
  count), then the album rows. Owner-only controls render inline: an `Add album` button, a
  `ListManagementMenu`, and a remove affordance per row. No separate editor screen. This mirrors how the
  album page composes view + actions and is the single biggest scope saving in the plan.
- **`list-management-menu.tsx`** — the owner's `MoreHorizontal` dropdown in the list header, holding
  `Rename list` and a destructive `Delete list`. Follow `ReviewManagementMenu`'s shape: dropdown plus a
  confirm `Dialog` for the destructive action. Without this there is no way to fix a typo in a title,
  which is the exact complaint reviews already have.
- **`edit-list-dialog.tsx`** — title + description, prefilled. Shares its field layout with
  `create-list-dialog.tsx`; extract the two fields into a small shared form rather than duplicating them.
- **`list-item-row.tsx`** — display index, `AlbumArtwork`, title, artist, year, linking to
  `/album/$albumId`. The index is a render-time `i + 1`, not a stored column. Reuse the layout language of
  `ReviewCard.Album` rather than inventing a new one.
- **`album-picker-dialog.tsx`** — a `CommandDialog` wrapping the existing `searchAlbums` server function,
  `useDebounce`, and `AlbumResultItem` from `components/global-search/`. Dim albums already in the list
  via the `dimmed` prop `AlbumResultItem` already accepts. Keep the dialog open after a selection so
  adding ten albums is ten clicks, not ten dialog round trips — this is the bulk-authoring path and it's
  what makes seeding twenty lists tolerable.
- **`create-list-dialog.tsx`** — title + description only, then navigate to the new list. Two fields,
  because everything else happens on the list page.
- **`list-card.tsx`** — stacked cover art, title, item count. Used by the profile tab.

Profile integration in `apps/web/src/routes/user/$username.tsx`:

- `type ProfileTab = "likes" | "lists" | "reviews"`
- Add the value to the `handleTabChange` guard
- A third `SwipeableTabsTrigger` and matching `SwipeableTabsContent`
- New `profile-lists-tab.tsx` / `profile-lists-section.tsx` following the existing reviews/likes pair,
  including `useLoadMoreOnIntersect` for pagination and an `EmptyState` for zero lists

Entry point for creation: a `New list` action in the profile Lists tab when you're viewing your own
profile. Do not add it to the top bar in v1.

All mutations follow `AGENTS.md`: explicit handlers calling `mutation.mutateAsync` wrapped in `tryCatch`,
with invalidation and toasts inline after the result, not in `onSuccess`/`onError`.

Query keys in `apps/web/src/lib/tanstack-query/query-keys.ts`:

```ts
export const listQueryKeys = {
  all: () => ["list"] as const,
  byUser: (profileUserId: string, viewerUserId?: string) =>
    viewerUserId
      ? (["list", "user", profileUserId, viewerUserId] as const)
      : (["list", "user", profileUserId] as const),
  detail: (listId: string, viewerUserId?: string) =>
    viewerUserId
      ? (["list", listId, "detail", viewerUserId] as const)
      : (["list", listId, "detail"] as const),
};
```

Both keys are **viewer-scoped**, matching `reviewQueryKeys.detail` / `.likes` / `.replies` and all of
`userQueryKeys`. This is not optional: `getListService` returns `canEdit`, so an unscoped key would let an
owner's cached `canEdit: true` survive sign-out and be served to an anonymous viewer.

## Phase 4 — Tests

Integration (`apps/web/tests/integration/server/services/list-service.integration.test.ts`):

- create / update / delete with ownership enforcement, and the admin delete bypass
- the 100-item cap
- items come back in insertion order, and a removal leaves the remainder in order
- adding an album not yet in the `album` table materializes it from Spotify metadata (mock
  `getAlbumPersistenceMetadata` as the existing review tests do)
- adding a duplicate album is a no-op, not an error
- a list by a banned author, and by an author with a null username, is not readable — but an admin viewer
  still gets the banned-author list back
- deleting a list cascades its items; deleting a user cascades their lists
- title and description length and whitespace checks reject at the DB level

Unit:

- `album-picker-dialog` — debounced search, dimming of already-added albums, dialog stays open after select
- `list-page` — owner sees add/remove/rename/delete controls, non-owner sees none, rows render 1..N
- `list-management-menu` — delete is behind a confirm dialog and does not fire on first click

Run `pnpm check:all` and `pnpm test:all`.

## Phase 5 — Docs

- `docs/product.md` — move `Lists: curated ranked or unranked album collections` out of `### Deferred`
  into the V1 feature list; add `/list/:listId` to the routes block and drop it from the deferred-routes
  sentence; add edge-case rows for `List by banned author`, `Album in a list removed from Spotify`, and
  `Duplicate album added to a list`.
- `docs/database.md` — new `## Lists` section covering the two tables, why there is no `position` column
  and how to add one later, the second album-materialization path, and the "albums with zero reviews are
  normal" consequence. Replace the stale `lists` / `listItems` sketch at the bottom of the file with a
  pointer to the real schema.

## After Shipping

The feature is the delivery mechanism; the content is the point. Block out an evening and write 15–20
real lists before you promo again. That is what turns a fifteen-album app into one that looks inhabited,
and it is the only step here that actually moves your stated goal.

`scripts/seed.mjs` exists if you want to bulk-load a skeleton, but the lists themselves should be authored
through the UI — both because they're your opinions and because it's the fastest way to find out whether
the bulk-add flow is actually pleasant.
