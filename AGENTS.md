# AGENTS.md

DIMENSION: React 19 + TypeScript + Vite frontend, Cloudflare-style function
router, and a C# desktop editor. Originally published through Qoder Sites.

## Self-hosting

The Qoder Sites runtime is not in the repo (it injected `functions/_qoder/backend.mjs`
and `storage.mjs` at deploy time), so the site could not run off Qoder. `server/`
replaces those platform pieces with local equivalents and mounts the unchanged
`functions/router.mjs` at `/functions/v1/app`, the path the frontend already calls.

- `server/db.mjs` — `db.from(...)` query builder over built-in `node:sqlite`
- `server/storage.mjs` — disk storage with HMAC-signed URLs
- `server/context.mjs` — per-request origin for absolute signed URLs
- `server/index.mjs` — serves `dist/` with SPA fallback, mounts the router
- `server/schema.sql`, `server/seed.mjs`, `server/live-content.json` — schema and
  a snapshot of the content that was live on Qoder (notices, updates, chat, settings)

Do not edit `functions/` or `src/` to make self-hosting work; the platform
boundary is entirely inside `server/`.

## Build and run

```bash
npm ci
npm run build          # tsc --noEmit && node scripts/build.mjs -> dist/
npm start              # node server/index.mjs, default port 8080
docker compose up -d --build
```

`package.json` declares a `preinstall` hook that runs `scripts/check-node.mjs`,
so anything installing dependencies must have `scripts/` present first. The
Dockerfile copies `scripts/` before `npm ci` for this reason.

Node 24 (or 22.13+) is required; `node:sqlite` needs no install or flag.

## Tests

- `dev/smoke-events.mjs` — passes against the self-hosted server.
- `dev/smoke-boards.mjs` — fails on the original Qoder dev server too (registers
  without an `email` field, which the router rejects). Pre-existing, not a
  migration regression; pass `email` to exercise the flow.

## Conventions and gotchas

- API routes live under `/functions/v1/app`; router paths are `/api/...`
  (e.g. `/api/register`, `/api/posts?board=free`, `/api/uploads/photo`,
  `/api/status`, `/api/admin/overview`).
- Registration fields: `username`, `password`, `nickname`, `email`.
  The first account to register becomes the admin.
- The in-game bridge authenticates with `x-bridge-key` against
  `INGAME_BRIDGE_SECRET` (or `bridge_key` in settings) and skips the browser
  origin check.
- Set `STORAGE_SECRET` to a fixed value in production or image links break on
  restart. Set `PUBLIC_ORIGIN` when behind a proxy so signed URLs use the
  public address.
- Runtime data (`/data`: `app.db`, `objects/`) is a volume and is git-ignored.

## Deploying

Target is Oracle Cloud Always Free (no cost, always on, persistent disk).
See `deploy/README.md` for the full walkthrough and `deploy/oracle-setup.sh`
for the on-VM bootstrap. The short version:

```bash
git clone git@github.com:yoonsin6919689-alt/DI.git dimension && cd dimension
sudo bash deploy/oracle-setup.sh          # Docker + instance firewall
printf 'STORAGE_SECRET=%s\nPUBLIC_ORIGIN=http://%s\nHOST_PORT=80\n' \
  "$(openssl rand -hex 32)" "$(curl -s ifconfig.me)" > .env
sudo docker compose up -d --build
```

Two firewall layers must both be open or the site is unreachable: the instance
iptables (the setup script handles it) and the VCN Security List in the web
console (manual, port 80/443).

## Git

- Remote: `git@github.com:yoonsin6919689-alt/DI.git`, branch `main`.
- SSH push works via `~/.ssh/di_deploy` (config in `~/.ssh/config`). The
  `GITHUB_TOKEN` in the environment is a read-only GitHub App token and cannot
  push.

## Why the site left Qoder

Qoder Sites was free only during the launch/trial period, and the individual
Free plan is static-only: "database and storage services are not supported"
(docs.qoder.com/qoder/sites.md). DIMENSION needs a database and image storage,
so it cannot run on the free tier. That is why the plan ran out mid-task.

