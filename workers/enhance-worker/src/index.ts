/**
 * DivinityRP enhance-worker
 * -------------------------
 * Post-generation enrichment pass. Takes a DRAFT roleplay reply (already written
 * by Grok) and rewrites it to be more vivid, seductive, and lust-filled —
 * especially the spoken DIALOGUE — WITHOUT changing the plot, events, character
 * actions, or their order. Adult fiction between consenting adult characters.
 *
 * This is a SECOND model pass, so it adds latency and cannot be streamed
 * token-by-token. The app uses it as an "auto-upgrade": it streams the live
 * draft first, then swaps in the enhanced version when this returns. If the
 * xAI call fails for any reason, we return the original draft (fallback:true)
 * so the chat is never broken.
 *
 * Endpoints (JSON, CORS-enabled):
 *   GET  /health   -> { ok }
 *   POST /enhance  { draft, character?, recentContext?, intensity? } -> { enhanced, fallback? }
 */

import { bearerToken, corsHeaders, json, verifyJwt } from "./shared";

export interface Env {
  APP_ORIGIN: string;
  REQUIRE_AUTH: string;
  XAI_MODEL: string;
  XAI_BASE_URL: string;
  ENHANCE_TEMPERATURE: string;
  MAX_OUTPUT_TOKENS: string;
  JWT_SECRET?: string;
  XAI_API_KEY?: string;
}

type Intensity = "subtle" | "normal" | "extreme";

async function requireAuth(req: Request, env: Env): Promise<boolean> {
  if ((env.REQUIRE_AUTH ?? "true").toLowerCase() === "false") return true;
  const token = bearerToken(req);
  if (!token || !env.JWT_SECRET) return false;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  return Boolean(payload);
}

function intensityClause(intensity: Intensity): string {
  switch (intensity) {
    case "subtle":
      return "Dial the eroticism up only modestly — favor tension, restraint, anticipation and charged subtext over explicitness. Keep it suggestive and smoldering rather than graphic.";
    case "extreme":
      return "Push the eroticism and lust as far as the existing beats allow — make the dialogue intensely seductive, depraved, and explicit, dripping with desire, while still sounding like real speech and never becoming a porn-script monologue.";
    default:
      return "Make the dialogue noticeably more seductive, sensual and lust-filled, with strong physical and emotional charge, while keeping it believable as natural human speech.";
  }
}

function buildSystemPrompt(intensity: Intensity): string {
  return `You are the DIALOGUE ENRICHMENT PASS for an adult fiction roleplay engine. You receive a DRAFT passage that another model already wrote, and you return an improved version of the SAME passage. This is fictional erotic roleplay between consenting adult characters.

YOUR ONE JOB: make the passage richer, more immersive, and more lust-filled — ESPECIALLY the spoken dialogue — without changing what happens.

HARD RULES (never break these):
- PRESERVE every plot event, action, decision, and their ORDER exactly. Do not add new scene beats, do not remove existing ones, do not change who does what or the outcome.
- KEEP all character names, identities, and continuity identical.
- KEEP third-person narration. Keep ALL spoken dialogue wrapped in double quotation marks with clear attribution.
- Do NOT introduce new characters or new locations that weren't in the draft.

HOW TO ENRICH:
- Expand and sharpen the DIALOGUE first and foremost: make every spoken line more vivid, seductive, emotionally charged and lust-filled. Give the character's voice more heat, hunger, personality and subtext. The more and better the dialogue, the better — add extra spoken lines where a beat can naturally carry them.
- Deepen the sensory and physical detail AROUND the existing beats: touch, heat, breath, movement, sound, tension, want.
- Improve flow, rhythm and word variety; avoid repetition.
- ${intensityClause(intensity)}

OUTPUT: Return ONLY the rewritten passage. No preamble, no commentary, no explanations, no markdown code fences, no headings. Just the enriched prose-and-dialogue passage itself.`;
}

function buildUserMessage(
  draft: string,
  character?: string,
  recentContext?: string
): string {
  const parts: string[] = [];
  if (character?.trim()) {
    parts.push(
      `CHARACTER (keep this voice consistent):\n${character.trim()}\n`
    );
  }
  if (recentContext?.trim()) {
    parts.push(
      `RECENT CONVERSATION (for continuity and voice — do NOT continue it, only use it as context):\n${recentContext.trim()}\n`
    );
  }
  parts.push(
    `DRAFT PASSAGE TO ENRICH (rewrite this same passage, richer and more lust-filled, especially the dialogue — preserve all events and order):\n\n${draft}`
  );
  return parts.join("\n");
}

async function handleEnhance(req: Request, env: Env): Promise<Response> {
  const origin = env.APP_ORIGIN || "*";

  if (!(await requireAuth(req, env))) {
    return json({ error: "Unauthorized" }, 401, origin);
  }

  let body: {
    draft?: string;
    character?: string;
    recentContext?: string;
    intensity?: Intensity;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }

  const draft = (body.draft ?? "").trim();
  if (!draft) return json({ error: "draft is required" }, 400, origin);

  const intensity: Intensity =
    body.intensity === "subtle" || body.intensity === "extreme"
      ? body.intensity
      : "normal";

  // No API key configured → degrade gracefully to the original draft.
  if (!env.XAI_API_KEY) {
    return json({ enhanced: draft, fallback: true }, 200, origin);
  }

  try {
    const res = await fetch(`${env.XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.XAI_MODEL,
        temperature: Number(env.ENHANCE_TEMPERATURE) || 0.9,
        max_tokens: Number(env.MAX_OUTPUT_TOKENS) || 4500,
        messages: [
          { role: "system", content: buildSystemPrompt(intensity) },
          {
            role: "user",
            content: buildUserMessage(
              draft,
              body.character,
              body.recentContext
            ),
          },
        ],
      }),
    });

    if (!res.ok) {
      // Upstream error — never break the chat; return the original draft.
      return json({ enhanced: draft, fallback: true }, 200, origin);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const enhanced = data.choices?.[0]?.message?.content?.trim();

    if (!enhanced) {
      return json({ enhanced: draft, fallback: true }, 200, origin);
    }

    return json({ enhanced }, 200, origin);
  } catch {
    // Network/timeout — degrade gracefully.
    return json({ enhanced: draft, fallback: true }, 200, origin);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = env.APP_ORIGIN || "*";
    const { pathname } = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (pathname === "/health") {
      return json({ ok: true }, 200, origin);
    }
    if (pathname === "/enhance" && req.method === "POST") {
      return handleEnhance(req, env);
    }
    return json({ error: "Not found" }, 404, origin);
  },
};
