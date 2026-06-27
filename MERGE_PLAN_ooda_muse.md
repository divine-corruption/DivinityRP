# Ooda Muse Upgrade — Final Scope (locked decisions)

Decisions: (1) memory per-CHARACTER, (2) lore matching client-side BEFORE send,
(3) ONE big PR, (4) OracleViewer already covered — skip, (5) add all features DivinityRP lacks.

## Method
Read the ENTIRE Ooda Muse source (not just README). Key discovery: the large
5000-line roleplay engine (scene state, action ledger, NPC autonomy, response
validator, PromptLayerManager) is **dormant** — `components/CharacterChat.tsx`
(the live chat) does NOT use it. It only calls `sendMessageToCharacter` +
the CharacterBrain functions. So "features it has" = what is actually WIRED.

## Features DivinityRP LACKS (this PR adds them)

### 1. CharacterBrain — per-character cross-session memory  [CORE]
Source: `CharacterBrain { recentResponses[], memoryBank: summary[], overviewMemory }`
on `Character`, compiled via `summarizeResponsesToMemory` + `summarizeMemoryBankOverview`.
Compile algorithm (from CharacterChat.tsx ~line 506):
- collect assistant response chunks from the conversation
- every 25 chunks -> 1 memoryBank summary (xAI summarize, 3rd person, <=8 bullets)
- short chats (<25) -> a `[Session: <title>]` summary
- if memoryBank.length >= 3 -> regenerate overviewMemory (<=12 bullets)
- persist brain on the character; mark node isClosed + compiledAt
Port target (DivinityRP, server stack):
- `Character.brain?: CharacterBrain` in lib/types.ts (+ roleplay-store action)
- persist brain in localStorage character payload (same as other char fields) — keeps
  parity with how DivinityRP already stores characters client-side; server compile via
  new `/api/brain/compile` (reuses existing /api/compile xAI plumbing)
- inject `overviewMemory` as a prompt layer in lib/ai/prompts.ts + route.ts

### 2. Smart lore injection — importance + keyword match  [CORE, client-side]
- add `importance: number` (1-10, default 5) to LoreEntry
- before send (client), scan last N messages for entry `keys`; keep matches with
  importance >= threshold; sort desc; cap count; pass as loreData
- settings: autoInjectLore (bool), loreImportanceThreshold (1-10)

### 3. Conversation lifecycle: isClosed + compiledAt
- add to ConversationThread; "Close & Compile" action in ConversationPicker -> calls (1)

### 4. ModelTester — compare models side by side
- new view + `/api/model-test` route that runs the same prompt across selected models
- DivinityRP uses xAI server-side; compare available Grok variants from /api/models

### 5. Settings additions
- globalSystemPrompt, customBonusPrompt (threaded into prompt), autoInjectLore,
  loreImportanceThreshold. Surface in settings-view.tsx.

## NOT porting (justification)
- Scene state / action ledger / NPC autonomy / response validator / PromptLayerManager:
  dormant in source (not wired to live generation). Porting = speculative scaffolding.
- localStorage/Bunny/Firebase/IndexedDB storage layer: DivinityRP uses Postgres/R2.
- Multi-provider (Ollama/Cloudflare/Together): DivinityRP is xAI server-side.

## Verification gate (same as v3.10.0)
tsc --noEmit clean -> version bump -> one PR -> merge to main (auto-deploy) -> release.
