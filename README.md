# DivinityRP

DIVINE — an immersive AI roleplay engine powered by xAI Grok 4.3. Built on Next.js (App Router) with a server runtime: streaming chat, a Character Forger, LoreUniverse, Story Arcs, a media Gallery with the **DivineVision** floating viewer, and Postgres-backed history/auth.

The app lives in [`chatbot/`](chatbot/).

## Features

- **Gallery System + DivineVision** — every piece of media (character art, AI-generated images, uploads) is collected into a filterable gallery. Selecting an item opens **DivineVision**, a floating viewer you can drag, resize, minimize and pin so media stays visible while you read or type.
- **Character Story Nodes** — pick from distinct story arcs/scenarios per character (browse, generate with Grok, or author your own) directly inside the character selector or from the chat header.
- **Character Forger** — upload 4 reference images and let xAI Grok 4.3 analyse the visuals and compile a full character card.
- **LoreUniverse + DivinityAI** — lorebooks, auto lore-detection and an AI lore assistant.

## Deployment

> [!IMPORTANT]
> This is a **server-rendered** Next.js application — it relies on live API routes (`/api/chat`, `/api/forge`, `/api/story-arcs`, `/api/imagine`, auth), a Postgres database and server-side streaming to xAI. It **cannot be hosted on GitHub Pages**, which only serves static files. Use a platform with a Node.js runtime.

### Recommended: Vercel (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/divine-corruption/DivinityRP&root-directory=chatbot)

This template is built for Vercel. Set the project **Root Directory** to `chatbot` and configure the environment variables below.

### CI deploys (GitHub Actions)

`.github/workflows/deploy-vercel.yml` deploys to Vercel on every push to `main`. To enable it:

1. Add repository **secret** `VERCEL_TOKEN`.
2. Add repository **variable** `ENABLE_VERCEL_DEPLOY` = `true`.
3. Run `vercel link` locally once (or let `vercel pull` create the project), so `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` are known to the token.

### Required environment variables

See [`chatbot/.env.example`](chatbot/.env.example). Key ones:

| Variable | Purpose |
| --- | --- |
| `XAI_API_KEY` | xAI Grok — powers chat, Character Forger, Story Arcs, DivinityAI (**required**) |
| `IMAGINE_API_KEY` | Vyro Imagine — in-chat image generation |
| `AUTH_SECRET` | NextAuth session secret |
| `POSTGRES_URL` | Chat history / users |
| `BLOB_READ_WRITE_TOKEN` | File uploads (Vercel Blob) |
| `REDIS_URL` | Resumable streams (optional) |

## Local development

```bash
cd chatbot
pnpm install
cp .env.example .env.local   # fill in the values above
pnpm dev
```
