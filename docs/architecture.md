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

## Coding Conventions

Implementation conventions for route organization, TanStack Query, server functions, and mutation handling live in `AGENTS.md` so coding agents and contributors follow the same rules.
