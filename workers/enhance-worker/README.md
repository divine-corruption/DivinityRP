# enhance-worker

Post-generation **response enrichment** for DivinityRP. Takes a draft roleplay
reply (already written by Grok) and rewrites it to be more vivid, seductive and
lust-filled — **especially the dialogue** — without changing the plot, the
events, the character actions, or their order.

Adult fiction between consenting adult characters.

## Endpoints

| Method | Path | Body / Auth | Returns |
| --- | --- | --- | --- |
| `GET` | `/health` | — | `{ ok }` |
| `POST` | `/enhance` | `{ draft, character?, recentContext?, intensity? }`, `Bearer ***  | `{ enhanced, fallback? }` |

`intensity` ∈ `subtle` \| `normal` (default) \| `extreme` — how hard to push the
lustful tone.

## The streaming trade-off (important)

This is a **second model pass**, so it adds latency and **cannot stream
token-by-token**. The Next.js app uses it as an *auto-upgrade*: it streams the
live draft as today, then calls `/enhance` and swaps in the richer version when
it returns. If `/enhance` is slow or fails, the user keeps the streamed draft.

**Graceful fallback is built in:** on any xAI error, empty result, missing API
key, or network/timeout, the worker returns `{ enhanced: <original draft>,
fallback: true }` with HTTP 200 — the chat is never broken by the enhancer.

## Deploy

```bash
cd workers/enhance-worker
npm install

# Shared secret (must match auth-worker + the other workers):
npx wrangler secret put JWT_SECRET
# xAI key used for the enrichment pass:
npx wrangler secret put XAI_API_KEY

npm run deploy
```

Then set in `chatbot/.env`:

```
ENHANCE_WORKER_URL=https:.workers.dev
# feature flags consumed by the app:
ENABLE_RESPONSE_ENHANCEMENT=true
RESPONSE_ENHANCEMENT_INTENSITY=normal
```

## Config (wrangler.toml [vars])

| Var | Default | Meaning |
| --- | --- | --- |
| `XAI_MODEL` | `grok-4` | Model used for the rewrite |
| `XAI_BASE_URL` | `https://api.x.ai/v1` | xAI OpenAI-compatible base |
| `ENHANCE_TEMPERATURE` | `0.9` | Sampling temperature for the rewrite |
| `MAX_OUTPUT_TOKENS` | `4500` | Output cap for the enriched passage |
| `REQUIRE_AUTH` | `true` | Require a valid auth-worker JWT |
