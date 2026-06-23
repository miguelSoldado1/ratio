# Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | TanStack Start | Currently wired through the TanStack Start Vite plugin |
| Deployment | Cloudflare Workers | Target deployment; Cloudflare adapter/config is not wired yet |
| Database | Supabase (Postgres) | No Supabase SDK needed; validate Worker-compatible Postgres connectivity before feature work |
| ORM | Drizzle | Postgres dialect |
| Auth | Better Auth (self-hosted) | Username + last-login-method plugins already wired |
| Music data | Spotify Web API | Client Credentials (anonymous) + user token (linked) |

## Route Organization

Route files should prefer TanStack Router's folder-style organization for nested/path segments, e.g. `src/routes/album/$albumId.tsx` for `/album/:albumId`, instead of flattened names such as `album.$albumId.tsx`.

## Data Fetching and Cache

- In React components, call TanStack Start server functions through `useServerFn(serverFn)` before passing them to `useQuery` or `useMutation`.
- Keep query keys in `src/lib/tanstack-query/query-keys.ts` and prefer hierarchical prefixes for related data. Album review data shares `albumQueryKeys.review(albumId)`, so create/delete review mutations can invalidate that review group with one TanStack Query prefix match.
- Keep shared TanStack Query defaults in `src/lib/tanstack-query/root-provider.tsx` instead of repeating options at individual call sites.

## Client Mutation Handling

For client-side mutations, prefer explicit submit/click handlers that call `mutation.mutateAsync(...)` wrapped in the shared `tryCatch` helper.

Handle success work such as cache updates, invalidation, local state resets, and toasts directly after the `tryCatch` result in that handler. Avoid `onSuccess`/`onError` mutation callbacks unless a mutation is intentionally shared and the lifecycle behavior belongs to every caller.
