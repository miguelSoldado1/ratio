# Reports & Moderation Queue — Implementation Plan

Working plan for adding user reports to Ratio. Delete this file once the feature ships and the
durable parts have been folded into `docs/product.md` and `docs/database.md`.

## Goal

Replies made harassment a real vector, and admin-side deletion is currently the only lever. Add a
`report` table so any signed-in user can flag a review or a reply, plus a moderation queue in the
admin app so those flags can be triaged instead of discovered by accident.

## Locked Decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Reportable targets | Reviews and replies. One polymorphic table with nullable `review_id` / `reply_id` and a check constraint enforcing exactly one, mirroring `notification` |
| D2 | Reason | Required `report_reason` pgEnum + optional free-text `details` (≤ 500 chars) |
| D3 | Workflow | Two states only: `pending` / `closed`. No resolver id, resolved timestamp, or moderator note in v1 |
| D4 | Admin surface | `apps/admin` only. The web app gains a Report action for users, nothing else |
| D5 | Evidence retention | No content snapshot. Report rows cascade away with their target |

D3 and D5 interact — see [Accepted Consequences](#accepted-consequences) before building.

## Schema

Add to `packages/database/src/schema.ts`, after `notifications` and before the `relations` block.

```ts
export const reportReason = pgEnum("report_reason", [
  "harassment",
  "hate_speech",
  "spam",
  "sexual_content",
  "self_harm",
  "other",
]);

export const reportStatus = pgEnum("report_status", ["pending", "closed"]);

export const reports = pgTable(
  "report",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterUserId: text("reporter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
    replyId: uuid("reply_id").references(() => reviewReplies.id, { onDelete: "cascade" }),
    reason: reportReason("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reports_status_created_id_idx").on(table.status, table.createdAt, table.id),
    index("reports_reporter_created_id_idx").on(table.reporterUserId, table.createdAt, table.id),
    index("reports_review_id_idx").on(table.reviewId).where(sql`${table.reviewId} is not null`),
    index("reports_reply_id_idx").on(table.replyId).where(sql`${table.replyId} is not null`),
    uniqueIndex("reports_reporter_review_unique_idx")
      .on(table.reporterUserId, table.reviewId)
      .where(sql`${table.reviewId} is not null`),
    uniqueIndex("reports_reporter_reply_unique_idx")
      .on(table.reporterUserId, table.replyId)
      .where(sql`${table.replyId} is not null`),
    check(
      "reports_target_exactly_one_check",
      sql`(${table.reviewId} is not null and ${table.replyId} is null)
        or (${table.reviewId} is null and ${table.replyId} is not null)`
    ),
    check(
      "reports_details_length_check",
      sql`${table.details} is null
        or (char_length(${table.details}) between 1 and 500 and ${table.details} ~ '[^[:space:]]')`
    ),
  ]
);
```

Index rationale, matching the conventions already in this schema:

- `(status, created_at, id)` — the queue read is "pending reports, newest first", with `status` as the
  only always-applied filter. Covers both tabs of the admin table.
- `(reporter_user_id, created_at, id)` — account deletion and per-reporter abuse checks.
- Partial `review_id` / `reply_id` indexes — the foreign-key cascade needs them, same as
  `notifications_review_id_idx`.
- The two partial unique indexes make a report idempotent per reporter per target, so one angry user
  cannot flood the queue with the same complaint.
- `details` check mirrors `review_replies_body_length_check`: null is fine, but a present body must be
  1–500 chars and contain a non-whitespace character.

Relations to append alongside the existing ones:

```ts
export const reportRelations = relations(reports, ({ one }) => ({
  reporter: one(user, {
    fields: [reports.reporterUserId],
    references: [user.id],
  }),
  review: one(reviews, {
    fields: [reports.reviewId],
    references: [reviews.id],
  }),
  reply: one(reviewReplies, {
    fields: [reports.replyId],
    references: [reviewReplies.id],
  }),
}));
```

Also extend `reviewRelations` and `reviewReplyRelations` with `reports: many(reports)`.

### Migration

Standard workflow from `docs/database.md`: `pnpm db:generate`, inspect the generated SQL, then
`pnpm db:migrate`. Two brand-new enums plus one new table, so this is additive and safe.

The next sequential migration is `0004`, but `docs/lists-plan.md` also targets `0004`. Whichever feature
ships second takes `0005`; do not hardcode the number when writing this up.

One forward-looking note worth putting in the migration's doc entry: the `notification_type` lesson in
`docs/database.md` applies the moment someone wants to **add** a reason to `report_reason`. Drizzle 0.45
wraps pending migrations in one transaction, and PostgreSQL cannot use a newly added enum value before
commit — so a future migration that adds a reason and then references it must recreate the type rather
than use `ALTER TYPE ... ADD VALUE`.

## Accepted Consequences

Read these before writing code; they are the direct result of D3 + D5.

1. **Deleting reported content deletes the report.** `onDelete: "cascade"` means the most common
   moderation outcome — "this reply is abusive, remove it" — makes the report row vanish rather than
   flipping it to `closed`. This is fine and self-cleaning, but the admin UI must not pretend
   otherwise: after a delete, invalidate the reports queue and toast something like
   `Reply deleted · 3 related reports cleared`. Do **not** try to close-then-delete in a transaction;
   the cascade wins regardless of ordering.
2. **No audit trail.** With no `resolved_by_user_id` / `resolved_at` / `moderator_note`, a closed
   report cannot answer "who closed this and why". That is acceptable with one admin. Adding those three
   nullable columns later is a purely additive migration, so this is not a trap — just a known gap.
3. **A closed report cannot be re-filed by the same user.** The partial unique indexes are on
   `(reporter, target)`, not `(reporter, target, status)`. If a report is dismissed, that reporter is
   done with that content. Intentional: it caps abuse of the report button itself.

## Phase 1 — Database

1. Edit `packages/database/src/schema.ts` per above.
2. `pnpm db:generate`, read the SQL, confirm both enums, the table, all six indexes, and both checks.
3. `pnpm db:migrate`.
4. `pnpm --filter @ratio/database typecheck`.
5. Commit schema + `drizzle/` together.

## Phase 2 — Web: create-report path

### `apps/web/src/server/services/report-service.ts`

Export `createReportService(data: CreateReportInput, context: AuthenticatedContext)`.

`CreateReportInput` is `{ reason, details?, reviewId? , replyId? }` with exactly one target id.

Validation order inside the service:

1. Resolve the target and its author in one query. For a review target, join `reviews → user`; for a
   reply target, join `reviewReplies → reviews → replyAuthor / reviewAuthor`.
2. Apply the same visibility rules the rest of the app uses: author `username is not null` and
   `banned is not true`, and for replies both the reply author and the root review author must pass.
   `getThreadVisibilityFilter` in `apps/web/src/server/services/review-reply-service.ts` already encodes
   this but is module-private — export it and reuse it rather than writing a second copy that can drift.
   Throw `new Error("Content not found")` when nothing matches, so hidden content is indistinguishable
   from missing content.
3. Reject self-reports: if the target author id equals `context.user.id`, throw
   `new Error("You can't report your own content")`. This cannot be a check constraint — it needs a join.
4. Insert with `.onConflictDoNothing()` against the relevant partial unique index and inspect
   `.returning()`. An empty result means the user already reported this target; surface that as a
   distinct, non-alarming error the UI can render as "You already reported this".

Return the created report id and nothing else. No notifications are generated — reporting is silent to
the reported user by design.

### `apps/web/src/server/functions/report-functions.ts`

```ts
export const createReport = createServerFn({ method: "POST" })
  .middleware([
    authMiddleware,
    createCloudflareRateLimitMiddleware(reportCreateRateLimit),
    createFixedWindowRateLimitMiddleware(reportCreateDailyRateLimit),
  ])
  .validator(createReportSchema)
  .handler(({ context, data }) => reportService.createReportService(data, context));
```

Zod schema:

```ts
const createReportSchema = z
  .object({
    // An untouched Textarea submits "", not undefined. Normalize before validating,
    // or "report with no details" fails on min(1).
    details: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || undefined)
      .optional(),
    reason: z.enum(reportReason.enumValues),
    replyId: z.uuid().optional(),
    reviewId: z.uuid().optional(),
  })
  .refine((value) => Boolean(value.reviewId) !== Boolean(value.replyId), {
    message: "Report exactly one review or reply",
  });
```

`reportReason.enumValues` derives the Zod enum from the Drizzle pgEnum so the two cannot drift.
`notification-service.ts:22` already uses this pattern for `notificationType`.

### Rate limiting

Two layers, following the existing pattern in `apps/web/src/server/rate-limit.ts`:

```ts
export const reportCreateRateLimit = defineCloudflareRateLimitRule({
  bindingName: "REPORT_CREATE_RATE_LIMITER",
});

export const reportCreateDailyRateLimit = defineFixedWindowRateLimitRule({
  limit: 20,
  scope: "report-create-daily",
  windowSeconds: 24 * 60 * 60,
});
```

Note that `getWindowResetAt` floors to aligned buckets, so this is a **UTC calendar-day** window that
resets at midnight UTC for everyone — not a rolling 24 hours. Fine here; just don't describe it as rolling.

Add the binding to **both** blocks of `apps/web/wrangler.jsonc` — the top-level `ratelimits` array and
the `env.development.ratelimits` array. Namespace ids follow the existing numbering: `1009` for
production, `2009` for development. `{ limit: 5, period: 60 }` is a sensible burst cap; a genuine
reporter never needs more.

Then run `pnpm cf-typegen` so `worker-configuration.d.ts` picks up the new binding.

## Phase 3 — Web: report UI

### New primitive

The reason picker wants a radio group, and `apps/web/src/components/ui` has no `radio-group` or `select`.
Add shadcn's `radio-group` — `apps/web/components.json` is on the `base-luma` (Base UI) style, matching
the rest of the app's primitives. Do not hand-roll a button list; the a11y semantics are the point.

### `apps/web/src/components/report-dialog.tsx`

One dialog serving both targets:

```ts
interface ReportDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: { type: "reply"; replyId: string } | { type: "review"; reviewId: string };
  targetAuthorName: string;
}
```

- Title copy differs by target type: `Report this review` / `Report this reply`.
- Radio group of the six reasons with human labels. Keep the label map in one exported constant so the
  admin app's column renderer can import the same wording — put it in
  `packages/database`? No: duplicating six strings across two apps is cheaper than a shared UI package.
  Define `reportReasonLabels` in each app and keep them in sync deliberately.
- Optional `Textarea` for details, max 500. Show the character count unconditionally — matches the
  reply composer decision in commit `3b41861` ("Always show reply character counts"). Over-length drafts
  stay editable but block submit, same as replies and reviews.
- Submit through `useServerFn(createReport)` + `useMutation`, called from an explicit handler wrapped in
  `tryCatch`, with cache/toast/reset work inline after the result — per `AGENTS.md`, not via
  `onSuccess`/`onError`.
- Success closes the dialog and toasts `Report received. Thanks for flagging this.` Nothing is
  invalidated; reports are write-only from the web app.
- The already-reported error gets its own toast rather than the generic failure copy.

### Menu wiring

`ReviewManagementMenu` (`apps/web/src/components/review-management-menu.tsx`) currently returns `null`
unless it has children or delete rights, and `ReplyManagementMenu` returns `null` unless the viewer can
delete. Both need to render for a plain signed-in non-author.

- Add `canReport: boolean` and `onReport: () => void` props to both menus.
- Update each early return: render when `children || canDelete || canReport`.
- Place `Report` below the existing items, separated by `DropdownMenuSeparator`, with a `Flag` lucide
  icon and default (non-destructive) variant.
- `canReport` = signed in, and the viewer is not the author. Reuse the existing shape at each call site:
  reviews expose `review.canDelete` (true for the author) and replies expose `reply.canDelete`, so
  `canReport = hasSession && !target.canDelete`. Signed-out viewers get no Report item — do not wire the
  auth dialog into this in v1.
- Rating-only reviews stay reportable. Spam and review-bombing are valid complaints about a review with
  no body.

Call sites to update:

- `apps/web/src/components/album-page/reviews-section.tsx`
- `apps/web/src/components/feed/feed-reviews-section.tsx`
- `apps/web/src/components/profile/profile-reviews-section.tsx`
- `apps/web/src/components/profile/profile-liked-reviews-section.tsx`
- `apps/web/src/components/profile/profile-review-management-menu.tsx` (pass the new props through)
- `apps/web/src/components/review-conversation/review-conversation-content.tsx` (root review)
- `apps/web/src/components/review-conversation/reply-row.tsx` (replies)

Own the dialog's open state at the section level, keyed by target id, so a single `ReportDialog` instance
serves a whole list rather than mounting one per card.

## Phase 4 — Admin: moderation queue

The users page is the template for this whole phase. Mirror its file layout exactly.

### `apps/admin/src/server/services/report-service.ts`

```ts
const sortColumns = { createdAt: reports.createdAt, reason: reports.reason, status: reports.status };

const filterColumns = {
  createdAt: reports.createdAt,
  details: reports.details,
  reason: reports.reason,
  status: reports.status,
};

const reportTableConfig: TableQueryConfig<typeof sortColumns, typeof filterColumns> = {
  sortColumns,
  filterColumns,
  dateColumns: new Set(["createdAt"]),
  enumColumns: new Set(["reason", "status"]),
  textColumns: new Set(["details"]),
};
```

`buildEnumCondition` in `apps/admin/src/server/table-query.ts` already handles both single and array
values, so multi-select reason filtering needs no changes to the shared query builder.

`getTableReportsService` — one query, left joins because the target is polymorphic:

- `reports` → inner join reporter `user`
- left join `reviews` on `reports.reviewId`, left join `reviewReplies` on `reports.replyId`
- left join a second `reviews` alias through the reply, to reach the album and permalink for reply rows
- left join `albums`, and aliased `user` rows for the review author and reply author

Derive on the server so the client renders dumbly:

- `targetType: sql<"reply" | "review">\`case when ${reports.reviewId} is not null then 'review' else 'reply' end\``
- `targetBody` — `coalesce(reviewReplies.body, reviews.body)`
- `targetAuthorId`, `targetAuthorName`, `targetAuthorUsername`, `targetAuthorImage` — each coalesced from
  the two author aliases. **`targetAuthorId` is not optional**: `report-actions-menu.tsx` calls
  `authClient.admin.banUser({ userId })`, and without it the Ban action has nothing to pass.
- `permalinkReviewId` — `coalesce(reports.reviewId, reviewReplies.reviewId)`, so both row types deep-link
  to `/review/:reviewId` on the web app via `getWebAppHref`

Add a free-text reporter filter the same way `review-service.ts` does it: strip `reporter` out of
`data.filters` before `buildQueryParams`, build a multi-term `ilike` across
`displayUsername / username / name`, and `and()` it onto the where clause. Same for sorting by reporter,
via the `reviewUserIdentity`-style `coalesce` sql expression.

Sibling report count is cheap and makes triage far better — add a correlated subquery so the row can show
`3 reports` on the same piece of content. Two things to get right, because the obvious version is subtly
wrong:

```sql
(select count(*)::int from report r2
  where case
    when report.review_id is not null then r2.review_id = report.review_id
    else r2.reply_id = report.reply_id
  end)
```

- **Do not filter on `status = 'pending'`.** The count is "how many people reported this content", not
  "how many are still open" — a closed report's row would otherwise render `0 reports`, which reads as a
  bug. If you ever want the open count too, add it as a second column rather than overloading this one.
- **The count includes the current report**, so a lone report shows `1 report`. That's the intended
  reading; state it in the column header tooltip rather than subtracting.
- The explicit `case` avoids relying on `NULL`-propagation through an `OR` across two nullable target
  columns. The `or` form happens to work, but only because `false OR NULL` is not `true` — not something
  the next reader should have to derive.

`getReportStatsService` — one pass with conditional counts, matching `getReviewStatsService`. Six values
feeding four cards: `pendingReports`, `closedReports`, `newLast7Days`, `newPrev7Days`, `reportedReviews`,
`reportedReplies`. The cards are Pending, Closed, New (7d) with `newPrev7Days` as its trend comparison,
and a Reviews/Replies split.

Mutations:

- `setReportStatusService({ reportId, status })` — flips `pending` ⇄ `closed`, returns the updated row,
  throws `Report not found` on an empty `.returning()`.
- `closeReportsForTargetService({ replyId?, reviewId? })` — bulk-close every pending report on one target,
  used by "Dismiss all reports on this content".

### `apps/admin/src/server/services/review-reply-service.ts` (new)

The admin app can delete reviews but has no reply deletion yet. Add `deleteReviewReplyService(replyId, context)`
mirroring `deleteReviewService`: unconditional delete by id, `.returning({ id })`, throw when missing.

A planned admin `/replies` page needs exactly this service too. Whichever lands first owns the file; the
other imports it. Do not write it twice.

### Server functions

Split by resource, matching the admin app's `X-functions.ts` ↔ `X-service.ts` pairing:

- `apps/admin/src/server/functions/report-functions.ts` — `getTableReports`, `getReportStats`,
  `setReportStatus`, `closeReportsForTarget`
- `apps/admin/src/server/functions/review-reply-functions.ts` (new) — `deleteReviewReply`

All behind `requireAdminMiddleware`, all validated with zod, `getTableReports` reusing `getTableDataInput`.

### Client

- `apps/admin/src/lib/tanstack-query/query-keys.ts` — add `adminReportQueryKeys` with `all` / `stats` /
  `table`, matching the existing two.
- `apps/admin/src/routes/_authenticated/reports.tsx` — same shell as `reviews.tsx`: heading, one-line
  description, `<ReportsStatsCards />`, `<ReportsTable />`.
- `apps/admin/src/components/admin-brand.tsx` — add `{ label: "Reports", to: "/reports" }` to `NAV_LINKS`.
  Consider making `/reports` the post-login redirect in `_authenticated/index.tsx` instead of `/users`,
  since the queue is the thing that needs attention.
- `apps/admin/src/components/reports/`:
  - `reports-columns.tsx` — Reporter (avatar + handle, external link to the profile), Target (badge
    `Review`/`Reply` + truncated body + sibling report count), Reason (badge, `multiSelect` filter with
    the six options), Details (truncated, `text` filter), Status (badge, `select` filter), Created date,
    and a pinned `actions` column.
  - `reports-table.tsx` — `useQueryTable` with `initialState.sorting = [{ id: "createdAt", desc: true }]`,
    `columnPinning.right = ["actions"]`, and an initial `status: "pending"` filter so the page opens on
    the live queue. Row activation opens the details dialog.
  - `reports-stats-cards.tsx` — four `StatCard`s off `getReportStats`, 5-minute `staleTime`.
  - `report-details-dialog.tsx` — reporter, reason, full details text, the full reported body, target
    author, a link to the web permalink, and the footer actions.
  - `report-actions-menu.tsx` — `Delete content`, `Ban author`, `Dismiss report`, `Dismiss all reports on
    this content`, `Reopen` (for closed rows). Each behind a confirm `Dialog`, each invalidating
    `adminReportQueryKeys.all()` plus `adminReviewQueryKeys.all()` / `adminUserQueryKeys.all()` where
    relevant. Ban reuses `authClient.admin.banUser` exactly as `user-actions-menu.tsx` does.

After a delete, remember consequence #1: the report rows are already gone via cascade. Word the toast to
say so instead of implying the report was closed.

## Phase 5 — Tests

Integration (`apps/web/tests/integration/server/services/report-service.integration.test.ts`):

- creates a report on a review and on a reply
- rejects a self-report on both target types
- rejects a duplicate from the same reporter, and confirms a different reporter succeeds
- rejects a target whose author is banned or has no username
- rejects both-targets-null and both-targets-set at the DB level (check constraint)
- rejects whitespace-only and over-length `details` at the DB level
- deleting the reported review/reply cascades its reports away

Integration (`apps/admin/tests/integration/report-service.integration.test.ts`):

- table pagination, `createdAt` sorting, reason multi-select filter, status filter, reporter text filter
- polymorphic row shape: a review report and a reply report both resolve target body, author, and
  `permalinkReviewId`
- sibling report count is correct with three reporters on one reply
- `setReportStatusService` round-trips and throws on an unknown id
- `closeReportsForTargetService` closes only that target's pending rows
- `getReportStatsService` numbers

Unit:

- `apps/web/tests/unit/src/components/report-dialog.test.tsx` — submit disabled until a reason is picked,
  character counter always visible, submit blocked over 500 chars, already-reported error rendered
  distinctly
- extend `apps/web/tests/unit/src/components/review-conversation/reply-thread.test.tsx` (or add a menu
  test) to cover Report appearing for a signed-in non-author and being absent when signed out

Checks to run: `pnpm check:all` and `pnpm test:all`. Per `AGENTS.md`, do not start a dev server as part
of the work.

## Phase 6 — Docs

- `docs/database.md` — new `## Reports` section: table design, the exactly-one-target check, the index
  rationale, the cascade decision from consequence #1, and the future enum-migration warning. While in
  this file, fix the stale line under Worker Compatibility claiming "The admin app performs no
  product/admin queries in this milestone" — it already queries users and reviews, and this adds a third.
- `docs/product.md` — move `User reports and moderation queue` out of `### Deferred` into the shipped
  feature list; describe the report action's placement and the silent-to-the-reported-user rule. Add
  edge-case table rows: `Report on content whose author is later banned`, `Reported content deleted by
  admin`, `Duplicate report from same user`, `Self-report attempt`.
- `docs/roadmap.md` — line 56 (`User reports and moderation queue in the separate admin app`) moves to
  shipped; line 32 already anticipates reports as bounded admin scope, so no change there.

## Deploy Order

1. Ship the migration first and confirm it on **both** the development and production databases
   independently — `docs/database.md` is explicit that a successful local migration says nothing about a
   Worker's remote database.
2. Deploy `apps/admin` so the queue exists before reports can arrive.
3. Deploy `apps/web` last, with the new rate-limit binding in place.
4. Smoke-test: file a report on a review and on a reply, confirm the duplicate is rejected, confirm both
   appear in the admin queue, close one, delete the content behind another and confirm the queue clears.

## Deferred

Explicitly out of scope, listed so the next thread does not creep:

- Reporting users/profiles rather than content
- Auto-hiding content above a report threshold
- Notifying reporters of the outcome
- Report analytics beyond the four stat cards
- `resolved_by_user_id` / `resolved_at` / `moderator_note` (additive later; see consequence #2)
