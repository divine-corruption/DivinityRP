# media-worker

Image / video upload, storage, and serving for DivinityRP, backed by Cloudflare R2.

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/upload` | yes* | multipart form `file`, optional `characterId`, `source` → `{ url, key, contentType, type, characterId? }` |
| `GET` | `/file/<key>` | no | Stream an object (used when `PUBLIC_BASE_URL` is unset) |
| `DELETE` | `/file/<key>` | yes* | Delete an object |
| `GET` | `/list?characterId=<id>` | yes* | List a character's media |
| `GET` | `/health` | no | `{ ok, bucketBound }` |

\* Auth required only when `REQUIRE_AUTH="true"` (default). Send `Authorization: Bearer <jwt>` minted by `auth-worker`.

## Per-character scoping

- With `characterId`: stored at `characters/<characterId>/<uuid>.<ext>` — each character has its own namespace.
- Without: `gallery/images/…`, `gallery/videos/…`, or `forge/…` (when `source=forge`).

## Deploy

```bash
cd workers/media-worker
npm install

# Create the R2 buckets once:
npx wrangler r2 bucket create divinityrp-media
npx wrangler r2 bucket create divinityrp-media-preview

# Shared secret used to verify auth-worker tokens (must match auth-worker's JWT_SECRET):
npx wrangler secret put JWT_SECRET

# (Optional) serve media from a public bucket domain instead of /file/:
#   set PUBLIC_BASE_URL in wrangler.toml [vars]

npm run deploy
```

After deploy, copy the Worker URL into `chatbot/.env` as `MEDIA_WORKER_URL`
(and `NEXT_PUBLIC_MEDIA_WORKER_URL` if you want the browser to hit it directly).

## Local dev

```bash
npm run dev          # wrangler dev, REQUIRE_AUTH can be set to "false" for testing
curl -F file=@pic.png http://localhost:8787/upload
```
