# Self-hosting DIMENSION

The site was published through Qoder Sites, whose runtime is not available
outside Qoder. This folder replaces that runtime with a small Node server so the
same frontend and business routes run on any Node host (a VPS, Fly.io, Railway,
Render, a home server, and so on).

Nothing in `functions/` or `src/` changed: the server mounts the existing
`functions/router.mjs` application at `/functions/v1/app`, which is the path the
frontend already calls.

## What the server provides

| Platform feature | Replacement |
| --- | --- |
| Query builder (`db.from(...)`) | `server/db.mjs` over `node:sqlite` |
| Object storage + signed URLs | `server/storage.mjs` (files on disk, HMAC-signed URLs) |
| Static hosting + SPA fallback | `server/index.mjs` serving `dist/` |
| Request context | `server/context.mjs` |

## Requirements

- Node.js 24 (or 22.13+) — `node:sqlite` is built in, so there is nothing to
  install for the database.
- The build output in `dist/` (`npm run build`).

## Run locally

```bash
npm ci
npm run build
STORAGE_SECRET=dev-secret npm start
# open http://localhost:8080
```

The first account that registers becomes the site admin. Notices, updates, chat
history and settings are seeded from `server/live-content.json`, which is a
snapshot of the content that was live on the Qoder site.

## Run with Docker

```bash
docker compose up -d --build
```

`docker-compose.yml` mounts a named volume at `/data`. The SQLite database
(`/data/app.db`) and uploaded images (`/data/objects`) live there, so they
survive restarts and redeploys.

## Environment variables

| Name | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Listen port |
| `HOST` | `0.0.0.0` | Listen address |
| `PUBLIC_ORIGIN` | request host | Origin used in signed image URLs. Set this when behind a proxy so URLs point at the public address. |
| `STORAGE_SECRET` | random per start | HMAC key for signed image URLs. Set a fixed value or image links break on restart. |
| `DATABASE_FILE` | `server/data/app.db` | SQLite file path |
| `STORAGE_DIR` | `server/data/objects` | Uploaded image directory |
| `DIST_DIR` | `./dist` | Built frontend directory |
| `INGAME_BRIDGE_SECRET` | none | Shared secret for the in-game plugin bridge (`/api/internal/*`) |

## Deploying

The container listens on `8080` and is stateless apart from `/data`. Point your
host's health check at `/functions/v1/app/api/health`, which returns
`{"ok":true}`.

For a custom domain, set `PUBLIC_ORIGIN` to that domain (for example
`https://dimension.example.com`) so signed image URLs use it. If your proxy
terminates TLS and forwards `X-Forwarded-Proto: https`, sessions are marked
`Secure` automatically.

## Notes

- `functions/index.ts` (the Deno entry point) is unused here; the Node server
  imports `functions/router.mjs` directly.
- The in-game plugin bridge still works: it authenticates with `x-bridge-key`
  against `INGAME_BRIDGE_SECRET` (or the `bridge_key` value in settings) and is
  exempt from the browser origin check, as before.
- Mass mail needs the HTTPS relay configured from the admin page, exactly as on
  the Qoder deployment.
