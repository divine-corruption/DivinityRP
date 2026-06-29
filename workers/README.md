# DivinityRP Cloudflare Workers

This directory contains the edge backend for DivinityRP, split into four
independent Cloudflare Workers. Each Worker is self-contained (its own
`wrangler.toml`, `package.json`, and `src/`) and can be deployed separately.

| Worker          | Path               | Purpose                                                                 | Bindings |
| --------------- | ------------------ | ----------------------------------------------------------------------- | -------- |
| `media-worker`  | `media-worker/`    | Image/media upload, per-character storage, serving (signed/public URLs) | R2 (`MEDIA`) |
| `backup-worker` | `backup-worker/`   | Versioned state snapshots, point-in-time recovery, scheduled backups    | R2 (`STATE`), Cron |
| `auth-worker`   | `auth-worker/`     | Registration, login, JWT sessions, password hashing                     | D1 (`DB`), KV (`SESSIONS`) |
| `enhance-worker`| `enhance-worker/`  | Post-generation response enrichment (richer, more lustful dialogue)     | (xAI via fetch) |

## Why Workers (and how they relate to the existing app)

The Next.js app (`../chatbot`) historically talked to Cloudflare **R2**
directly from its server routes. These Workers move that responsibility to the
edge so that:

- **Media + state survive independently of the Next.js host.** Even if the app
  is redeployed, restarted, or the serverless filesystem is wiped, media and
  versioned state live in R2 behind stable Worker endpoints.
- **Backups are continuous and recoverable.** `backup-worker` keeps timestamped
  snapshots and exposes a restore API + a scheduled (cron) safety net, so the
  app can always be recovered to its latest good state.
- **Auth is centralized.** `auth-worker` owns identity so every other surface
  (app + workers) can verify the same JWT.
- **Responses get a second, enriching pass.** `enhance-worker` rewrites a draft
  reply to be more detailed and lust-filled, especially the dialogue.

## Shared conventions

- All workers accept/return JSON and set permissive CORS for the app origin
  (configurable via the `APP_ORIGIN` var).
- All mutating endpoints require a valid bearer JWT minted by `auth-worker`
  (verified with the shared `JWT_SECRET`), except where explicitly noted.
- Secrets are set with `wrangler secret put <NAME>` — never committed.

## Deploy order

1. `auth-worker`   (mints the JWTs the others trust)
2. `media-worker`
3. `backup-worker`
4. `enhance-worker`

Then set the resulting Worker URLs in `../chatbot/.env` (see
`../chatbot/.env.example`, the `*_WORKER_URL` keys) and redeploy the app.

See each worker's own `README.md` for endpoints and exact deploy steps, and
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full end-to-end runbook.
