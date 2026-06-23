# Roadmap

## Build Order

Work in this sequence to validate the riskiest integrations first before building features on top.

```text
1. TanStack Start app baseline - already present locally
2. Cloudflare adapter/config - deploy hello world
3. Supabase connection + Drizzle - connect from Worker, run a test query
4. Better Auth - confirm existing setup works end to end in Worker context
5. Spotify Client Credentials - server token, fetch a public album, render it
6. Album page /album/:spotifyId - metadata, fully public, no auth required
7. Search - Spotify search API, debounced, cached
8. Auth UI - Spotify plus selected OAuth providers; account linking in /settings
9. Rating flow - score input, DB write, display on album page
10. Spotify account linking - retrieve token, confirm feed upgrade
11. Feed - popular first, then personalised once Spotify linking is in
12. User profiles - rating history, follow graph
13. Likes + social activity
```

## Open Decisions

- **Additional OAuth providers**: Spotify is required for login/linking; decide which other providers belong in the product.
- **Review deletion UX**: users should eventually be able to delete their one review, but editing/updating remains out of scope.
- **Spotify reconnect UX**: soft prompt in feed/settings, or hard gate on personalised features?
