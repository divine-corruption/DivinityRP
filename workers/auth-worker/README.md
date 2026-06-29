# auth-worker

Centralized identity for DivinityRP. Mints HS256 JWTs that every other worker
(and the Next.js app) verifies with the shared `JWT_SECRET`. Passwords are
hashed with PBKDF2-SHA256 (210k iterations) via WebCrypto.

## Endpoints

| Method | Path | Body / Auth | Returns |
| --- | --- | --- | --- |
| `POST` | `/register` | `{ email, password, name? }` | `{ token, user }` |
| `POST` | `/login` | `{ email, password }` | `{ token, user }` |
| `POST` | `/guest` | — | `{ token, user }` (anonymous) |
| `GET` | `/verify` | `Bearer ***  | `{ valid, user? }` |
| `GET` | `/me` | `Bearer ***  | `{ user }` |
| `POST` | `/logout` | `Bearer ***  | `{ ok }` (revokes the token's jti) |
| `GET` | `/health` | — | `{ ok, dbBound }` |

## Storage

- **D1** (`DB`, database `divinityrp-auth`): `users` + `refresh_tokens` (see `schema.sql`).
- **KV** (`SESSIONS`): issued-jti tracking + revocation set for `/logout`.

## Deploy

```bash
cd workers/auth-worker
npm install

# 1) Create D1 + KV, then paste their IDs into wrangler.toml:
npx wrangler d1 create divinityrp-auth         # -> copy database_id
npx wrangler kv namespace create SESSIONS      # -> copy id

# 2) Initialize the schema:
npm run init-db                                # runs schema.sql against D1

# 3) Set the shared secret (MUST be identical across all workers + the app):
npx wrangler secret put JWT_SECRET

npm run deploy
```

After deploy, set in `chatbot/.env`:

```
AUTH_WORKER_URL=https://divinityrp-auth-worker.<subdomain>.workers.dev
NEXT_PUBLIC_AUTH_WORKER_URL=https://divinityrp-auth-worker.<subdomain>.workers.dev
AUTH_JWT_SECRET=<same value as JWT_SECRET>
```

## Notes

- `JWT_SECRET` is the trust anchor for the whole system. Generate a strong one:
  `openssl rand -base64 48`.
- Tokens default to a 7-day lifetime (`ACCESS_TTL`). `/logout` revokes by `jti`
  via KV so a stolen token can be killed before expiry.
