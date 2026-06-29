# DivinityRP — Cloudflare Workers Deployment Runbook

This guide deploys the four edge Workers and connects them to the Next.js app
(`../chatbot`). Everything is **optional and additive**: with no Workers
configured the app behaves exactly as before (R2-direct / Vercel Blob / local FS,
no response enhancement). Configure a Worker and the app routes through it.

## Prerequisites

- A Cloudflare account.
- `npm i -g wrangler` (or use `npx wrangler`), then `wrangler login`.
- An xAI API key (for the enhance-worker).

## 0. Generate the shared secret (do this first)

Every Worker AND the app verify the same HS256 JWT, so they must share one
secret. Generate it once and reuse it everywhere:

```bash
openssl rand -base64 48
```

Keep this value handy — referred to below as `$JWT_SECRET`.

---

## 1. auth-worker (deploy first — it mints the tokens the others trust)

```bash
cd workers/auth-worker
npm install

# Create D1 + KV, paste the printed IDs into wrangler.toml:
npx wrangler d1 create divinityrp-auth         # -> database_id
npx wrangler kv namespace create SESSIONS      # -> id

# Initialize the users/refresh_tokens schema:
npm run init-db

# Set the shared secret:
npx wrangler secret put JWT_SECRET             # paste $JWT_SECRET

npm run deploy                                 # note the deployed URL
```

## 2. media-worker

```bash
cd ../media-worker
npm install

npx wrangler r2 bucket create divinityrp-media
npx wrangler r2 bucket create divinityrp-media-preview

npx wrangler secret put JWT_SECRET             # same $JWT_SECRET
npm run deploy                                 # note the URL
```

(Optional) to serve media from a public bucket domain instead of through the
worker's `/file/` route, set `PUBLIC_BASE_URL` in `media-worker/wrangler.toml`.

## 3. backup-worker

```bash
cd ../backup-worker
npm install

npx wrangler r2 bucket create divinityrp-state
npx wrangler r2 bucket create divinityrp-state-preview

npx wrangler secret put JWT_SECRET             # same $JWT_SECRET
npm run deploy                                 # note the URL
```

Runs a safety cron every 6 hours (`crons` in wrangler.toml). Versioned snapshots
are kept under `state/users/<userId>/history/<ts>.json`, capped at `MAX_VERSIONS`.

## 4. enhance-worker

```bash
cd ../enhance-worker
npm install

npx wrangler secret put JWT_SECRET             # same $JWT_SECRET
npx wrangler secret put XAI_API_KEY            # your xAI key
npm run deploy                                 # note the URL
```

---

## 5. Wire the app

Add to `chatbot/.env` (and your Vercel project env), using the URLs from above:

```bash
JWT_SECRET=$JWT_SECRET            # MUST match every worker (app reuses AUTH_SECRET if unset)

MEDIA_WORKER_URL=https:.workers.dev
AUTH_WORKER_URL=https://divinityrp-auth-worker.<acct>.workers.dev
BACKUP_WORKER_URL=https://divinityrp-backup-worker.<acct>.workers.dev
ENHANCE_WORKER_URL=https:....workers.dev

# Response enhancement (off by default):
ENABLE_RESPONSE_ENHANCEMENT=true
RESPONSE_ENHANCEMENT_INTENSITY=normal          # subtle | normal | extreme
NEXT_PUBLIC_ENABLE_RESPONSE_ENHANCEMENT=true   # shows the per-message Enhance button
```

Redeploy the app. Done.

---

## What each piece does (and the bugs this fixes)

| Concern (from the brief) | How it's addressed |
| --- | --- |
| "App doesn't allow uploads" | Uploads already existed but silently failed when no durable store was configured (local FS is read-only on Vercel). `media-worker` is now the **preferred** upload target (`/api/upload` → media-worker → R2 → Blob → local), R2-backed and persistent across all instances. |
| "Gallery should be specific for each character" | Fixed the real bug: there was no per-character image action. Added `addImageToCharacter` / `removeImageFromCharacter` to the store — uploads attach to that character's own `images[]` AND mirror into the global gallery tagged with `characterId`. Uploads are stored under `characters/<id>/…` in R2. |
| "Record of everything + recover after data loss" | `backup-worker` keeps **versioned** snapshots (not just last-write-wins) with a restore API + 6-hourly cron. The app's existing `/api/state` sync still works; backup-worker adds point-in-time recovery. Also fixed `/api/repository` which used an in-memory `Map` (wiped on every restart) — now R2-durable. |
| "Auth system + worker" | `auth-worker` owns identity: register / login / guest / verify / logout, PBKDF2-hashed passwords, HS256 JWTs with KV-based revocation. |
| "More detailed, lustful responses, enhance dialogue after creation" | `enhance-worker` does a second pass that rewrites a draft reply to be richer and more lust-filled — **especially the dialogue** — without changing plot/events. Exposed via `/api/enhance` and a per-message **Enhance ✨** button. Graceful fallback to the original draft on any failure. |

## Verification

Each worker:

```bash
cd workers/<name>
npm run typecheck     # tsc --noEmit, exits 0
npm run dry-run       # wrangler deploy --dry-run, builds + shows bindings
curl https://<worker-url>/health
```

The app:

```bash
cd chatbot
pnpm install
npx tsc --noEmit      # exits 0
```

## Follow-up / optional enhancement

The per-message **Enhance ✨** button is shipped and verifiable. An *automatic*
post-stream auto-swap (stream the draft, then silently replace it with the
enriched version) can be layered on later by calling `/api/enhance` from the
chat hook's `onFinish` and updating the message via `setMessages` — the same
swap logic the button already uses. It was left as an opt-in follow-up because it
touches the live streaming hook and needs browser testing to validate UX.
