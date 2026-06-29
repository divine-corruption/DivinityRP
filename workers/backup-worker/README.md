# divinityrp-backup-worker

Versioned snapshots of each user's roleplay state in Cloudflare R2, with
point-in-time recovery and a scheduled (cron) safety heartbeat.

The Next.js app stores per-user state as a single "latest" JSON doc:

    state/users/<userId>/roleplay.json     # last-write-wins, read by the app

This worker keeps that pointer compatible **and** maintains an append-only
history so state can be recovered after loss or corruption:

    state/users/<userId>/history/<timestampMs>.json

Old versions beyond `MAX_VERSIONS` (default 50) are pruned automatically on
each snapshot/restore.

## Endpoints

All responses are JSON and CORS-enabled. Authentication uses an auth-worker
JWT (`Authorization: Bearer <token>`) verified against `JWT_SECRET`, unless
`REQUIRE_AUTH="false"`. The authenticated user id is the JWT `sub` claim.

| Method | Path                 | Body                      | Returns |
| ------ | -------------------- | ------------------------- | ------- |
| GET    | `/health`            | —                         | `{ ok, bucketBound }` |
| POST   | `/snapshot`          | `{ state, label? }`       | `{ ok, version, key }` |
| GET    | `/snapshot`          | `?version=<ts>` (optional)| `{ version, state }` (latest if omitted; 404 if missing) |
| GET    | `/versions`          | —                         | `{ versions: [{ version, key, size, uploaded, label }] }` (newest-first) |
| POST   | `/restore`           | `{ version }`             | `{ ok, restoredFrom, newVersion }` |
| DELETE | `/versions/<ts>`     | —                         | `{ ok }` |

### POST /snapshot
Writes two objects:
1. The **latest pointer** at `state/users/<userId>/roleplay.json` (so the app's
   existing reader keeps working).
2. A **versioned copy** at `state/users/<userId>/history/<timestampMs>.json`
   with `customMetadata { label, createdAt }`.

Then prunes the oldest history entries beyond `MAX_VERSIONS`.

### POST /restore
Copies a historical version back over the latest pointer **and** writes a new
history entry labeled `restore of <version>`.

## Scheduled (cron)

`crontab = ["0 */6 * * *"]` — every 6 hours. The handler is a non-destructive
retention heartbeat that only logs liveness; per-user snapshots (and pruning)
are driven by the app via `POST /snapshot`.

## Deploy

```sh
# One-time: create the R2 bucket (matches wrangler.toml bucket_name)
wrangler r2 bucket create divinityrp-state
# (optional preview bucket for `wrangler dev`)
wrangler r2 bucket create divinityrp-state-preview

# One-time: set the shared HMAC secret used to verify auth-worker JWTs
wrangler secret put JWT_SECRET

# Type-check + dry run
npm install
npm run typecheck
npm run dry-run

# Deploy
npm run deploy
```

## Configuration (wrangler.toml `[vars]`)

| Var            | Default | Purpose |
| -------------- | ------- | ------- |
| `APP_ORIGIN`   | `*`     | CORS allow-origin |
| `MAX_VERSIONS` | `50`    | Max history snapshots kept per user |
| `REQUIRE_AUTH` | `true`  | Require a valid JWT (`"false"` only for local testing) |

`JWT_SECRET` is a **secret** (not a var) — set it via `wrangler secret put JWT_SECRET`.

## Bindings

- `STATE` → R2 bucket `divinityrp-state` (preview: `divinityrp-state-preview`)
