# AGENTS.md

## Assisted Workflow

- Do not start long-running dev servers automatically during assisted changes. The developer prefers to run `pnpm run dev` or `pnpm run dev:cf` manually.
- Use checks such as `pnpm run typecheck`, `pnpm run check`, targeted `pnpm exec ultracite check <files>`, and `pnpm run build` for verification unless a dev server is explicitly requested.
- If a dev server is explicitly requested, stop it before finishing unless the developer asks to leave it running.
- Read the relevant planning docs before changing product, architecture, database, or Spotify behavior.

## Implementation Conventions

- Route files should prefer TanStack Router's folder-style organization for nested/path segments, e.g. `src/routes/album/$albumId.tsx` for `/album/:albumId`, instead of flattened names such as `album.$albumId.tsx`.
- In React components, call TanStack Start server functions through `useServerFn(serverFn)` before passing them to `useQuery` or `useMutation`.
- Keep query keys in `src/lib/tanstack-query/query-keys.ts` and prefer hierarchical prefixes for related data. Album review data shares `albumQueryKeys.review(albumId)`, so create/delete review mutations can invalidate that review group with one TanStack Query prefix match.
- Keep shared TanStack Query defaults in `src/lib/tanstack-query/root-provider.tsx` instead of repeating options at individual call sites.
- For client-side mutations, prefer explicit submit/click handlers that call `mutation.mutateAsync(...)` wrapped in the shared `tryCatch` helper.
- Handle success work such as cache updates, invalidation, local state resets, and toasts directly after the `tryCatch` result in that handler. Avoid `onSuccess`/`onError` mutation callbacks unless a mutation is intentionally shared and the lifecycle behavior belongs to every caller.

## Reference Docs

- `docs/product.md`: product concept, routes, features, feed logic, rating display, design rules, and edge cases.
- `docs/architecture.md`: current stack and major infrastructure choices.
- `docs/database.md`: schema ownership, Drizzle migration workflow, Better Auth schema changes, Worker compatibility, and table design.
- `docs/spotify.md`: attribution, token behavior, album caching, and search rules.
- `docs/roadmap.md`: build order and open product decisions.
