# TanStack Start + shadcn/ui

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
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

For local development, keep using `.env` with `DATABASE_URL`, `BETTER_AUTH_URL`, and the OAuth client values. Use `pnpm run dev` for normal Vite development or `pnpm run dev:cf` when you want to exercise the Cloudflare runtime locally.
